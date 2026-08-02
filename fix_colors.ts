import fs from 'fs';

const content = fs.readFileSync('src/components/MolStudioViewer.tsx', 'utf8');

const newCode = content.replace(
    `          // Dim unselected
          viewer.setStyle({}, getStyleObj(renderStyle, 'white', 0.3));
             
          // Highlight selected
          const selArray = Array.from(selectedAtomSerials);
          viewer.setStyle({ serial: selArray }, { 
            ...getStyleObj(renderStyle, 'magenta', 1.0),
            stick: { radius: 0.15, color: 'magenta' } // Always show sticks for selected
          });`,
    `          // Dim unselected
          viewer.setStyle({}, getStyleObj(renderStyle, colorScheme, 0.3));
             
          // Highlight selected
          const selArray = Array.from(selectedAtomSerials);
          viewer.setStyle({ serial: selArray }, { 
            ...getStyleObj(renderStyle, 'magenta', 1.0),
            stick: { radius: 0.15, color: 'magenta' } // Always show sticks for selected
          });`
);

fs.writeFileSync('src/components/MolStudioViewer.tsx', newCode);
