const ssData = [
  { ss_type: 'loop', chainID: 'A', resi: 1 },
  { ss_type: 'helix', chainID: 'A', resi: 2 },
  { ss_type: 'helix', chainID: 'A', resi: 3 },
  { ss_type: 'loop', chainID: 'A', resi: 4 }
];
for (let i = 0; i < ssData.length; i++) {
   const ss = ssData[i];
   const prev = ssData[i-1];
   const next = ssData[i+1];
      
   let ssbegin = false;
   let ssend = false;
      
   if (ss.ss_type !== 'loop' && ss.ss_type !== 'undetermined') {
       if (!prev || prev.chainID !== ss.chainID || prev.ss_type !== ss.ss_type) {
           ssbegin = true;
       }
       if (!next || next.chainID !== ss.chainID || next.ss_type !== ss.ss_type) {
           ssend = true;
       }
   }
   console.log(`resi: ${ss.resi}, ssbegin: ${ssbegin}, ssend: ${ssend}`);
}
