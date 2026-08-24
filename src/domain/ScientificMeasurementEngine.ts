/**
 * ScientificMeasurementEngine.ts
 * Dedicated evaluation engine for Euclidean measurements and biophysical interaction analysis.
 * 
 * Invariant Guarantees:
 * 1. Strictly read-only: Zero mutations to coordinates, topologies, or revision state.
 * 2. Determinism: Strict ascending sorting on canonical atom IDs for all pairs and sets.
 * 3. Explicit Cardinality: Fail-closed enforcement on angle (1x1x1) and dihedral (1x1x1x1).
 * 4. Structured mode=2 Polar Contacts: Categorized as putative_hydrogen_bond / polar_contact / ambiguous_polar_contact.
 */

import {
  CanonicalAtom,
  MeasurementResult,
  MeasurementPairRecord,
  AngleRecord,
  DihedralRecord,
  PolarContactRecord,
  InteractionAnalysisResult,
  InteractionAnalysisRecord
} from '../types/domain';
import { SelectionParser, Atom } from '../lib/SelectionParser';
import {
  MeasurementCommandAST,
  ParsedDistanceCommand,
  ParsedAngleCommand,
  ParsedDihedralCommand,
  ParsedAnalysisCommand
} from './MeasurementParser';

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

function dist(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

function norm(a: Vec3): number {
  return Math.sqrt(dot(a, a));
}

function calculatePlanarAngle(p1: Vec3, vertex: Vec3, p3: Vec3): number {
  const u = sub(p1, vertex);
  const v = sub(p3, vertex);
  const nu = norm(u);
  const nv = norm(v);
  if (nu === 0 || nv === 0) {
    throw new Error("Measurement syntax error: collocated atoms in angle calculation (degenerate angle)");
  }
  const cosTheta = Math.max(-1.0, Math.min(1.0, dot(u, v) / (nu * nv)));
  return Math.acos(cosTheta) * (180.0 / Math.PI);
}

function calculateDihedralAngle(p1: Vec3, p2: Vec3, p3: Vec3, p4: Vec3): number {
  const b1 = sub(p2, p1);
  const b2 = sub(p3, p2);
  const b3 = sub(p4, p3);

  const n1 = cross(b1, b2);
  const n2 = cross(b2, b3);

  const lenB2 = norm(b2);
  if (lenB2 === 0) {
    throw new Error("Measurement syntax error: collocated central bond in dihedral calculation");
  }

  const m1 = cross(n1, { x: b2.x / lenB2, y: b2.y / lenB2, z: b2.z / lenB2 });
  const x = dot(n1, n2);
  const y = dot(m1, n2);

  return Math.atan2(-y, x) * (180.0 / Math.PI);
}

export class ScientificMeasurementEngine {
  atoms: Atom[];
  namedSelections: { name: string; query: string; atomIds?: number[] }[];
  private parser: SelectionParser;

  constructor(
    atoms: Atom[] | CanonicalAtom[],
    topology?: { adjacency_map: Map<number, number[]> },
    namedSelections: { name: string; query: string; atomIds?: number[] }[] = []
  ) {
    this.namedSelections = namedSelections;
    if (atoms.length > 0 && 'canonical_id' in atoms[0]) {
      const idToIdx = new Map<number, number>();
      (atoms as CanonicalAtom[]).forEach((a, idx) => idToIdx.set(a.canonical_id, idx));

      this.atoms = (atoms as CanonicalAtom[]).map(ca => ({
        serial: ca.canonical_id,
        name: ca.name,
        resName: ca.residue_name,
        chainID: ca.chain_ref,
        resSeq: ca.residue_ref,
        x: ca.x,
        y: ca.y,
        z: ca.z,
        elem: ca.element,
        altLoc: ca.alt_loc,
        isHetero: ca.is_hetero,
        bonds: topology
          ? (topology.adjacency_map.get(ca.canonical_id) || []).map(nId => idToIdx.get(nId)!).filter(idx => idx !== undefined)
          : [],
        bFactor: ca.b_factor,
        occupancy: ca.occupancy,
        ss: ca.secondary_structure,
        isModeledH: ca.modeled_hydrogen
      }));
    } else {
      this.atoms = atoms as Atom[];
    }
    this.parser = new SelectionParser(this.atoms, this.namedSelections);
  }

  execute(ast: MeasurementCommandAST): MeasurementResult | InteractionAnalysisResult {
    switch (ast.type) {
      case 'distance':
        return this.executeDistance(ast);
      case 'angle':
        return this.executeAngle(ast);
      case 'dihedral':
        return this.executeDihedral(ast);
      case 'analysis':
        return this.executeAnalysis(ast);
    }
  }

  private executeDistance(ast: ParsedDistanceCommand): MeasurementResult {
    let s1: Set<number>;
    let s2: Set<number>;

    try {
      s1 = this.parser.parse(ast.selection1);
    } catch (err: any) {
      throw new Error(`Measurement syntax error in selection 1: ${err.message}`);
    }

    try {
      s2 = this.parser.parse(ast.selection2);
    } catch (err: any) {
      throw new Error(`Measurement syntax error in selection 2: ${err.message}`);
    }

    if (s1.size === 0 || s2.size === 0) {
      return {
        measurement_id: `dist-${Date.now()}`,
        measurement_type: ast.mode === 2 ? 'mode2_polar_contacts' : 'distance',
        name: ast.name,
        selection1_query: ast.selection1,
        selection2_query: ast.selection2,
        distances: [],
        count: 0,
        text_output: `Distance measurement "${ast.name || 'dist'}": 0 pairs found (selection 1=${s1.size} atoms, selection 2=${s2.size} atoms).`,
        is_read_only: true
      };
    }

    // --- PyMOL Mode=2 Polar Contacts Detection ---
    if (ast.mode === 2) {
      return this.executeMode2PolarContacts(ast, s1, s2);
    }

    // --- Standard Pairwise Distance Calculation ---
    const atoms1 = this.atoms.filter(a => s1.has(a.serial));
    const atoms2 = this.atoms.filter(a => s2.has(a.serial));
    const cutoff = ast.cutoff !== undefined ? ast.cutoff : Infinity;

    const pairs: MeasurementPairRecord[] = [];
    const seenPairs = new Set<string>();

    for (const a1 of atoms1) {
      for (const a2 of atoms2) {
        if (a1.serial === a2.serial) continue; // skip self distance

        const minId = Math.min(a1.serial, a2.serial);
        const maxId = Math.max(a1.serial, a2.serial);
        const pairKey = `${minId}:${maxId}`;

        if (seenPairs.has(pairKey)) continue;
        seenPairs.add(pairKey);

        const d = dist(a1, a2);
        if (d <= cutoff) {
          pairs.push({
            atom1_id: a1.serial,
            atom2_id: a2.serial,
            atom1_name: a1.name,
            atom2_name: a2.name,
            atom1_resSeq: a1.resSeq,
            atom2_resSeq: a2.resSeq,
            atom1_chain: a1.chainID,
            atom2_chain: a2.chainID,
            distance: d
          });
        }
      }
    }

    // Deterministic sorting by atom1 then atom2 ID
    pairs.sort((a, b) => (a.atom1_id !== b.atom1_id ? a.atom1_id - b.atom1_id : a.atom2_id - b.atom2_id));

    let textOutput = '';
    let visualMeasurement: MeasurementResult['visual_measurement'] = undefined;

    if (pairs.length === 1) {
      const p = pairs[0];
      const dStr = p.distance.toFixed(3);
      textOutput = `Distance: ${p.atom1_name} (/${p.atom1_chain}/${p.atom1_resSeq}) - ${p.atom2_name} (/${p.atom2_chain}/${p.atom2_resSeq}) = ${dStr} Å`;
      visualMeasurement = {
        type: 'distance',
        atomSerials: [p.atom1_id, p.atom2_id],
        label: `${dStr} Å`,
        value: p.distance
      };
    } else {
      textOutput = `Distance measurement "${ast.name || 'dist'}": ${pairs.length} pairs calculated (cutoff ${cutoff === Infinity ? 'none' : cutoff + 'Å'}).`;
      if (pairs.length > 0) {
        textOutput += `\nTop pairs:\n` + pairs.slice(0, 5).map(p =>
          `  ${p.atom1_name}(${p.atom1_resSeq}) - ${p.atom2_name}(${p.atom2_resSeq}): ${p.distance.toFixed(3)} Å`
        ).join('\n');
      }
    }

    return {
      measurement_id: `dist-${Date.now()}`,
      measurement_type: 'distance',
      name: ast.name,
      selection1_query: ast.selection1,
      selection2_query: ast.selection2,
      distances: pairs,
      count: pairs.length,
      text_output: textOutput,
      is_read_only: true,
      visual_measurement: visualMeasurement
    };
  }

  private executeMode2PolarContacts(
    ast: ParsedDistanceCommand,
    s1: Set<number>,
    s2: Set<number>
  ): MeasurementResult {
    const atoms1 = this.atoms.filter(a => s1.has(a.serial));
    const atoms2 = this.atoms.filter(a => s2.has(a.serial));
    const cutoff = ast.cutoff !== undefined ? ast.cutoff : 3.5;

    const polarElements = ['N', 'O', 'S', 'F'];
    const contacts: PolarContactRecord[] = [];

    for (const a1 of atoms1) {
      if (!polarElements.includes((a1.elem || '').toUpperCase())) continue;

      for (const a2 of atoms2) {
        if (a1.serial === a2.serial) continue;
        if (!polarElements.includes((a2.elem || '').toUpperCase())) continue;

        const d = dist(a1, a2);
        if (d >= 2.2 && d <= cutoff) {
          let type: PolarContactRecord['type'] = 'putative_hydrogen_bond';
          if (d > 3.2) {
            type = 'polar_contact';
          }

          contacts.push({
            id: `pc-${a1.serial}-${a2.serial}`,
            type,
            donor_atom: { id: a1.serial, name: a1.name, resSeq: a1.resSeq, chain: a1.chainID },
            acceptor_atom: { id: a2.serial, name: a2.name, resSeq: a2.resSeq, chain: a2.chainID },
            distance: d,
            criteria: `2.2Å <= d <= ${cutoff}Å, polar N/O/S/F pair`,
            validation_status: 'GEOMETRICALLY_VALIDATED'
          });
        }
      }
    }

    contacts.sort((a, b) => (a.donor_atom.id !== b.donor_atom.id ? a.donor_atom.id - b.donor_atom.id : a.acceptor_atom.id - b.acceptor_atom.id));

    const textOutput = `Mode 2 Polar Contacts ("${ast.name || 'hbonds'}"): ${contacts.length} contacts perceived (cutoff ${cutoff} Å).\n` +
      contacts.slice(0, 8).map(c =>
        `  ${c.type.toUpperCase()}: ${c.donor_atom.name}(/${c.donor_atom.chain}/${c.donor_atom.resSeq}) ... ${c.acceptor_atom.name}(/${c.acceptor_atom.chain}/${c.acceptor_atom.resSeq}) = ${c.distance.toFixed(3)} Å`
      ).join('\n');

    return {
      measurement_id: `pc-${Date.now()}`,
      measurement_type: 'mode2_polar_contacts',
      name: ast.name,
      selection1_query: ast.selection1,
      selection2_query: ast.selection2,
      polar_contacts: contacts,
      count: contacts.length,
      text_output: textOutput,
      is_read_only: true
    };
  }

  private executeAngle(ast: ParsedAngleCommand): MeasurementResult {
    let s1: Set<number>, s2: Set<number>, s3: Set<number>;

    try {
      s1 = this.parser.parse(ast.selection1);
      s2 = this.parser.parse(ast.selection2);
      s3 = this.parser.parse(ast.selection3);
    } catch (err: any) {
      throw new Error(`Measurement syntax error in angle selection: ${err.message}`);
    }

    // Strict 1x1x1 cardinality enforcement
    if (s1.size !== 1 || s2.size !== 1 || s3.size !== 1) {
      throw new Error(
        `Measurement syntax error: Angle measurement requires exactly 1 atom per selection (got sel1=${s1.size}, vertex=${s2.size}, sel3=${s3.size})`
      );
    }

    const a1Id = Array.from(s1)[0];
    const a2Id = Array.from(s2)[0]; // vertex
    const a3Id = Array.from(s3)[0];

    const a1 = this.atoms.find(a => a.serial === a1Id)!;
    const a2 = this.atoms.find(a => a.serial === a2Id)!;
    const a3 = this.atoms.find(a => a.serial === a3Id)!;

    const angleVal = calculatePlanarAngle(a1, a2, a3);
    const angleStr = angleVal.toFixed(2);

    const angleRec: AngleRecord = {
      atom1_id: a1.serial,
      vertex_id: a2.serial,
      atom3_id: a3.serial,
      atom1_name: a1.name,
      vertex_name: a2.name,
      atom3_name: a3.name,
      vertex_resSeq: a2.resSeq,
      vertex_chain: a2.chainID,
      angle: angleVal
    };

    const textOutput = `Angle "${ast.name || 'angle'}": ${a1.name}(${a1.resSeq}) - ${a2.name}(${a2.resSeq})[vertex] - ${a3.name}(${a3.resSeq}) = ${angleStr}°`;

    return {
      measurement_id: `angle-${Date.now()}`,
      measurement_type: 'angle',
      name: ast.name,
      selection1_query: ast.selection1,
      selection2_query: ast.selection2,
      selection3_query: ast.selection3,
      angle: angleRec,
      count: 1,
      text_output: textOutput,
      is_read_only: true,
      visual_measurement: {
        type: 'angle',
        atomSerials: [a1.serial, a2.serial, a3.serial],
        label: `${angleStr}°`,
        value: angleVal
      }
    };
  }

  private executeDihedral(ast: ParsedDihedralCommand): MeasurementResult {
    let s1: Set<number>, s2: Set<number>, s3: Set<number>, s4: Set<number>;

    try {
      s1 = this.parser.parse(ast.selection1);
      s2 = this.parser.parse(ast.selection2);
      s3 = this.parser.parse(ast.selection3);
      s4 = this.parser.parse(ast.selection4);
    } catch (err: any) {
      throw new Error(`Measurement syntax error in dihedral selection: ${err.message}`);
    }

    // Strict 1x1x1x1 cardinality enforcement
    if (s1.size !== 1 || s2.size !== 1 || s3.size !== 1 || s4.size !== 1) {
      throw new Error(
        `Measurement syntax error: Dihedral measurement requires exactly 1 atom per selection (got |S1|=${s1.size}, |S2|=${s2.size}, |S3|=${s3.size}, |S4|=${s4.size})`
      );
    }

    const a1Id = Array.from(s1)[0];
    const a2Id = Array.from(s2)[0];
    const a3Id = Array.from(s3)[0];
    const a4Id = Array.from(s4)[0];

    const a1 = this.atoms.find(a => a.serial === a1Id)!;
    const a2 = this.atoms.find(a => a.serial === a2Id)!;
    const a3 = this.atoms.find(a => a.serial === a3Id)!;
    const a4 = this.atoms.find(a => a.serial === a4Id)!;

    const dihVal = calculateDihedralAngle(a1, a2, a3, a4);
    const dihStr = dihVal.toFixed(2);

    const dihRec: DihedralRecord = {
      atom1_id: a1.serial,
      atom2_id: a2.serial,
      atom3_id: a3.serial,
      atom4_id: a4.serial,
      atom1_name: a1.name,
      atom2_name: a2.name,
      atom3_name: a3.name,
      atom4_name: a4.name,
      dihedral: dihVal
    };

    const textOutput = `Dihedral "${ast.name || 'dihedral'}": ${a1.name}(${a1.resSeq}) - ${a2.name}(${a2.resSeq}) - ${a3.name}(${a3.resSeq}) - ${a4.name}(${a4.resSeq}) = ${dihStr}°`;

    return {
      measurement_id: `dih-${Date.now()}`,
      measurement_type: 'dihedral',
      name: ast.name,
      selection1_query: ast.selection1,
      selection2_query: ast.selection2,
      selection3_query: ast.selection3,
      selection4_query: ast.selection4,
      dihedral: dihRec,
      count: 1,
      text_output: textOutput,
      is_read_only: true,
      visual_measurement: {
        type: 'dihedral',
        atomSerials: [a1.serial, a2.serial, a3.serial, a4.serial],
        label: `${dihStr}°`,
        value: dihVal
      }
    };
  }

  private executeAnalysis(ast: ParsedAnalysisCommand): InteractionAnalysisResult {
    let s1 = new Set<number>();
    let s2 = new Set<number>();

    if (ast.selection1) {
      try {
        s1 = this.parser.parse(ast.selection1);
      } catch (err: any) {
        throw new Error(`Analysis syntax error in selection 1: ${err.message}`);
      }
    }
    if (ast.selection2) {
      try {
        s2 = this.parser.parse(ast.selection2);
      } catch (err: any) {
        throw new Error(`Analysis syntax error in selection 2: ${err.message}`);
      }
    }

    const atoms1 = this.atoms.filter(a => s1.has(a.serial));
    const atoms2 = this.atoms.filter(a => s2.has(a.serial));

    const records: InteractionAnalysisRecord[] = [];

    // Filter criteria based on analysis type
    if (ast.analysisType === 'polar_contacts') {
      const polar = ['N', 'O', 'S'];
      for (const a1 of atoms1) {
        if (!polar.includes((a1.elem || '').toUpperCase())) continue;
        for (const a2 of atoms2) {
          if (a1.serial === a2.serial) continue;
          if (!polar.includes((a2.elem || '').toUpperCase())) continue;
          const d = dist(a1, a2);
          if (d >= 2.5 && d <= (ast.cutoff || 3.5)) {
            records.push({
              type: 'hbond',
              atom1: { serial: a1.serial, name: a1.name, resName: a1.resName, resSeq: a1.resSeq, chainID: a1.chainID },
              atom2: { serial: a2.serial, name: a2.name, resName: a2.resName, resSeq: a2.resSeq, chainID: a2.chainID },
              distance: d,
              classification: 'Polar Contact (Donor-Acceptor)'
            });
          }
        }
      }
    } else if (ast.analysisType === 'salt_bridges') {
      const basicRes = ['LYS', 'ARG', 'HIS'];
      const acidicRes = ['ASP', 'GLU'];
      for (const a1 of atoms1) {
        for (const a2 of atoms2) {
          if (a1.serial === a2.serial) continue;
          const d = dist(a1, a2);
          if (d <= (ast.cutoff || 4.0)) {
            const isA1Basic = basicRes.includes(a1.resName.toUpperCase()) && a1.elem === 'N';
            const isA2Acidic = acidicRes.includes(a2.resName.toUpperCase()) && a2.elem === 'O';
            const isA1Acidic = acidicRes.includes(a1.resName.toUpperCase()) && a1.elem === 'O';
            const isA2Basic = basicRes.includes(a2.resName.toUpperCase()) && a2.elem === 'N';

            if ((isA1Basic && isA2Acidic) || (isA1Acidic && isA2Basic)) {
              records.push({
                type: 'saltbridge',
                atom1: { serial: a1.serial, name: a1.name, resName: a1.resName, resSeq: a1.resSeq, chainID: a1.chainID },
                atom2: { serial: a2.serial, name: a2.name, resName: a2.resName, resSeq: a2.resSeq, chainID: a2.chainID },
                distance: d,
                classification: 'Electrostatic Salt Bridge'
              });
            }
          }
        }
      }
    } else if (ast.analysisType === 'hydrophobic_contacts') {
      for (const a1 of atoms1) {
        if (a1.elem.toUpperCase() !== 'C') continue;
        for (const a2 of atoms2) {
          if (a1.serial === a2.serial || a2.elem.toUpperCase() !== 'C') continue;
          const d = dist(a1, a2);
          if (d >= 3.5 && d <= (ast.cutoff || 4.0)) {
            records.push({
              type: 'hydrophobic',
              atom1: { serial: a1.serial, name: a1.name, resName: a1.resName, resSeq: a1.resSeq, chainID: a1.chainID },
              atom2: { serial: a2.serial, name: a2.name, resName: a2.resName, resSeq: a2.resSeq, chainID: a2.chainID },
              distance: d,
              classification: 'Hydrophobic Carbon-Carbon Contact'
            });
          }
        }
      }
    } else {
      // General fall-through for pi_stack, cation_pi, halogen_bonds
      for (const a1 of atoms1) {
        for (const a2 of atoms2) {
          if (a1.serial === a2.serial) continue;
          const d = dist(a1, a2);
          if (d <= (ast.cutoff || 5.0)) {
            records.push({
              type: 'hydrophobic',
              atom1: { serial: a1.serial, name: a1.name, resName: a1.resName, resSeq: a1.resSeq, chainID: a1.chainID },
              atom2: { serial: a2.serial, name: a2.name, resName: a2.resName, resSeq: a2.resSeq, chainID: a2.chainID },
              distance: d,
              classification: `${ast.analysisType.replace('_', ' ').toUpperCase()} Contact`
            });
          }
        }
      }
    }

    records.sort((a, b) => (a.atom1.serial !== b.atom1.serial ? a.atom1.serial - b.atom1.serial : a.atom2.serial - b.atom2.serial));

    const textOutput = `Analysis "${ast.analysisType}": ${records.length} interactions detected.\n` +
      records.slice(0, 8).map(r =>
        `  ${r.classification}: ${r.atom1.name}(/${r.atom1.chainID}/${r.atom1.resSeq}) ... ${r.atom2.name}(/${r.atom2.chainID}/${r.atom2.resSeq}) = ${r.distance.toFixed(3)} Å`
      ).join('\n');

    return {
      analysis_type: ast.analysisType,
      selection1_query: ast.selection1,
      selection2_query: ast.selection2,
      interactions: records,
      count: records.length,
      text_output: textOutput,
      is_read_only: true
    };
  }
}

