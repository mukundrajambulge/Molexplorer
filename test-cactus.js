fetch('https://cactus.nci.nih.gov/chemical/structure/CCO/file?format=sdf&get3d=true')
  .then(res => res.text())
  .then(text => console.log(text.slice(0, 200)));
