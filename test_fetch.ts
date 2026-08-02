async function test() {
  const fetchId = "1hvr";
  const res = await fetch(`https://files.rcsb.org/download/${fetchId.toUpperCase()}.pdb`);
  const text = await res.text();
  console.log(text.substring(0, 500));
  console.log("Has REMARK 350:", text.includes("REMARK 350"));
}
test();
