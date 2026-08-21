import crypto from 'crypto';
import { CanonicalMolecule } from '../types/domain';

/**
 * Computes deterministic SHA-256 hash digest over a CanonicalMolecule graph.
 * Incorporates canonical atoms, elements, coordinates, formal charges, residue sequence,
 * chain refs, and sorted covalent bond topology.
 */
export function computeCanonicalStateHash(molecule: CanonicalMolecule): string {
  const hash = crypto.createHash('sha256');

  // 1. Molecule metadata
  hash.update(`mol:${molecule.molecule_id}:${molecule.name}\n`);

  // 2. Atoms (Sorted by canonical_id)
  const sortedAtoms = [...molecule.atoms].sort((a, b) => a.canonical_id - b.canonical_id);
  for (let i = 0; i < sortedAtoms.length; i++) {
    const a = sortedAtoms[i];
    hash.update(
      `atom:${a.canonical_id}:${a.element}:${a.name}:${a.chain_ref}:${a.residue_ref}:${a.residue_name}:${a.x.toFixed(4)}:${a.y.toFixed(4)}:${a.z.toFixed(4)}:${a.is_hetero}:${a.formal_charge}:${a.alt_loc}\n`
    );
  }

  // 3. Topology Bonds (Sorted by normalized atom_a, then atom_b)
  const sortedBonds = [...molecule.topology.bonds].sort((a, b) => {
    if (a.atom_a !== b.atom_a) return a.atom_a - b.atom_a;
    return a.atom_b - b.atom_b;
  });
  for (let i = 0; i < sortedBonds.length; i++) {
    const b = sortedBonds[i];
    hash.update(`bond:${b.atom_a}:${b.atom_b}:${b.order}:${b.is_aromatic}\n`);
  }

  // 4. Residues (Sorted by residue_id)
  const sortedResidues = [...molecule.residues].sort((a, b) => a.residue_id.localeCompare(b.residue_id));
  for (let i = 0; i < sortedResidues.length; i++) {
    const r = sortedResidues[i];
    hash.update(`res:${r.residue_id}:${r.name}:${r.chain_ref}:${r.res_seq}:${r.atom_ids.join(',')}\n`);
  }

  // 5. Chains (Sorted by chain_id)
  const sortedChains = [...molecule.chains].sort((a, b) => a.chain_id.localeCompare(b.chain_id));
  for (let i = 0; i < sortedChains.length; i++) {
    const c = sortedChains[i];
    hash.update(`chain:${c.chain_id}:${c.residue_ids.join(',')}\n`);
  }

  return hash.digest('hex');
}

/**
 * Computes deterministic SHA-256 hash digest for a ScientificRevision record.
 */
export function computeRevisionHash(
  parentRevisionId: string | null,
  operationId: string,
  canonicalStateHash: string,
  timestamp: string
): string {
  const hash = crypto.createHash('sha256');
  hash.update(`${parentRevisionId || 'ROOT'}:${operationId}:${canonicalStateHash}:${timestamp}`);
  return hash.digest('hex');
}
