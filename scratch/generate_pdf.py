import os
import re
from fpdf import FPDF

class MolStudioPDF(FPDF):
    def __init__(self):
        super().__init__(orientation="P", unit="mm", format="A4")
        self.set_margins(15, 20, 15)
        self.set_auto_page_break(auto=True, margin=20)
        
    def header(self):
        if self.page_no() > 1:
            self.set_font("helvetica", "I", 8)
            self.set_text_color(74, 74, 106)
            self.cell(0, 8, "MolStudio vs PyMOL: Complete Gap Analysis & Implementation Plan", align="R")
            self.ln(8)
            self.set_draw_color(226, 232, 240)
            self.line(15, self.get_y(), 195, self.get_y())
            self.ln(5)

    def footer(self):
        if self.page_no() > 1:
            self.set_y(-15)
            self.set_font("helvetica", "I", 8)
            self.set_text_color(148, 163, 184)
            # Line above footer
            self.set_draw_color(226, 232, 240)
            self.line(15, self.get_y() - 2, 195, self.get_y() - 2)
            self.cell(0, 10, f"Page {self.page_no()}", align="C")

def clean_md_formatting(text):
    # Remove markdown link syntax [label](url) -> label
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)
    # Remove bold/italic markers
    text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)
    text = re.sub(r'__([^_]+)__', r'\1', text)
    text = re.sub(r'\*([^*]+)\*', r'\1', text)
    # Remove inline code backticks
    text = re.sub(r'`([^`]+)`', r'\1', text)
    
    # Replace Unicode characters with ASCII equivalents to prevent Helvetica encoding errors
    replacements = {
        '—': '--', # Em-dash
        '–': '-',  # En-dash
        '≤': '<=', # Less than or equal
        '≥': '>=', # Greater than or equal
        '•': '-',  # Bullet
        '✓': '[Match]', # Check
        '✅': '[Done]',
        '❌': '[Missing]',
        '⚠️': '[Warning]',
        '×': 'x',  # Multiply
        'Å': 'A',  # Angstrom
        'Å': 'A',
        'φ': 'phi',
        'ψ': 'psi',
        'θ': 'theta',
        'σ': 'sigma',
        'ω': 'omega',
        'Δ': 'Delta',
        'π': 'pi',
        '⁺': '+',
        '⁻': '-',
        '°': ' deg',
        '…': '...',
        '⃗': '', # Vector arrow
        'd̄': 'd_mean',
    }
    
    for uni, asc in replacements.items():
        text = text.replace(uni, asc)
        
    # Replace any other non-ASCII chars
    text = text.encode('ascii', 'ignore').decode('ascii')
    
    return text.strip()

def main():
    md_path = "C:/Users/mukun/.gemini/antigravity/brain/86ba0017-cb90-4a97-b810-88a7266b3c45/implementation_plan.md"
    pdf_path = "C:/Users/mukun/.gemini/antigravity/brain/86ba0017-cb90-4a97-b810-88a7266b3c45/MolStudio_Implementation_Plan.pdf"

    if not os.path.exists(md_path):
        print(f"Error: {md_path} not found.")
        return

    with open(md_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    pdf = MolStudioPDF()
    pdf.add_page()
    
    # --- COVER PAGE ---
    pdf.set_y(50)
    pdf.set_font("helvetica", "B", 28)
    pdf.set_text_color(79, 70, 229) # Indigo
    pdf.cell(0, 15, "MolStudio", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)
    
    pdf.set_font("helvetica", "B", 18)
    pdf.set_text_color(26, 26, 46) # Dark Blue
    pdf.cell(0, 12, "Complete Gap Analysis &", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 12, "Implementation Plan", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)
    
    pdf.set_font("helvetica", "I", 12)
    pdf.set_text_color(74, 74, 106)
    pdf.cell(0, 8, "Science + Engineering + Architecture", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 8, "Every Feature. Every Equation. Every Citation.", align="C", new_x="LMARGIN", new_y="NEXT")
    
    pdf.set_y(150)
    pdf.set_font("helvetica", "", 10)
    pdf.set_text_color(74, 74, 106)
    pdf.cell(0, 6, "Document Type: Technical Implementation Plan", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 6, "Version: 1.0", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 6, "Date: August 4, 2026", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 6, "Classification: Internal -- Engineering Team", align="C", new_x="LMARGIN", new_y="NEXT")
    
    pdf.set_y(220)
    pdf.set_font("helvetica", "B", 10)
    pdf.set_text_color(26, 26, 46)
    pdf.cell(0, 6, "Goal:", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("helvetica", "", 10)
    pdf.set_text_color(74, 74, 106)
    pdf.cell(0, 6, "Achieve industry-grade parity with PyMOL, backed by", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 6, "peer-reviewed science and traceable to 24+ research paper citations.", align="C", new_x="LMARGIN", new_y="NEXT")
    
    pdf.add_page()
    
    # --- PARSING MARKDOWN CONTENT ---
    pdf.set_text_color(26, 26, 46)
    
    in_table = False
    table_headers = []
    table_rows = []
    
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        # Skip horizontal rules
        if line == "---" or line == "___":
            i += 1
            continue
            
        # Parse Tables
        if line.startswith("|"):
            if not in_table:
                in_table = True
                table_headers = [clean_md_formatting(cell) for cell in line.split("|")[1:-1]]
                table_rows = []
                # Skip the next line which is the separator |---|---|
                i += 2
                continue
            else:
                cells = [clean_md_formatting(cell) for cell in line.split("|")[1:-1]]
                table_rows.append(cells)
                i += 1
                continue
        else:
            if in_table:
                # Render table
                in_table = False
                col_count = len(table_headers)
                if col_count > 0:
                    pdf.set_font("helvetica", "B", 8)
                    pdf.set_fill_color(241, 245, 249) # Light slate
                    pdf.set_draw_color(226, 232, 240)
                    with pdf.table(line_height=5) as table:
                        # Headers
                        row = table.row()
                        for h in table_headers:
                            row.cell(h)
                        # Data
                        pdf.set_font("helvetica", "", 7.5)
                        for r in table_rows:
                            # Pad/trim row elements to match header column count
                            r = (r + [""] * col_count)[:col_count]
                            row = table.row()
                            for c in r:
                                row.cell(c)
                    pdf.ln(5)
            
        # Parse Alerts/Blockquotes
        if line.startswith(">"):
            pdf.set_fill_color(238, 242, 255) # Indigo light
            pdf.set_draw_color(79, 70, 229)
            text_inside = ""
            while i < len(lines) and lines[i].strip().startswith(">"):
                text_inside += lines[i].strip().replace(">", "").strip() + " "
                i += 1
            text_inside = clean_md_formatting(text_inside.replace("[!IMPORTANT]", "IMPORTANT:").replace("[!TIP]", "TIP:"))
            pdf.set_font("helvetica", "I", 9.5)
            pdf.set_text_color(55, 48, 163)
            # Render multi-line box
            pdf.multi_cell(0, 5, text_inside, border="L", fill=True)
            pdf.ln(4)
            pdf.set_text_color(26, 26, 46)
            continue

        # Headers
        if line.startswith("# "):
            title = clean_md_formatting(line[2:])
            pdf.ln(8)
            pdf.set_font("helvetica", "B", 18)
            pdf.set_text_color(79, 70, 229)
            pdf.cell(0, 10, title, new_x="LMARGIN", new_y="NEXT")
            pdf.ln(4)
            pdf.set_text_color(26, 26, 46)
        elif line.startswith("## "):
            title = clean_md_formatting(line[3:])
            pdf.ln(6)
            pdf.set_font("helvetica", "B", 13)
            pdf.set_text_color(79, 70, 229)
            pdf.cell(0, 8, title, new_x="LMARGIN", new_y="NEXT")
            # Bottom blue line for H2
            pdf.set_draw_color(79, 70, 229)
            pdf.line(pdf.get_x(), pdf.get_y() - 1, pdf.get_x() + 180, pdf.get_y() - 1)
            pdf.ln(2)
            pdf.set_text_color(26, 26, 46)
        elif line.startswith("### "):
            title = clean_md_formatting(line[4:])
            pdf.ln(4)
            pdf.set_font("helvetica", "B", 10.5)
            pdf.cell(0, 6, title, new_x="LMARGIN", new_y="NEXT")
            pdf.ln(1)
        # Lists
        elif line.startswith("- ") or line.startswith("* "):
            content = clean_md_formatting(line[2:])
            pdf.set_font("helvetica", "", 9.5)
            # Indented bullet point
            pdf.set_x(20)
            pdf.cell(5, 5, "-", align="L") # Bullet point char
            pdf.multi_cell(0, 5, content)
            pdf.set_x(15)
        # Regular text
        elif line:
            content = clean_md_formatting(line)
            pdf.set_font("helvetica", "", 9.5)
            pdf.multi_cell(0, 5, content)
            pdf.ln(2)
            
        i += 1

    pdf.output(pdf_path)
    print("PDF successfully generated by fpdf2!")

if __name__ == "__main__":
    main()
