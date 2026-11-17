import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

def create_timesheet_workbook():
    wb = openpyxl.Workbook()
    default_sheet = wb.active
    
    # STYLES & PALETTE
    cyan_fill = PatternFill(start_color="00E5FF", end_color="00E5FF", fill_type="solid")
    yellow_fill = PatternFill(start_color="FFFF00", end_color="FFFF00", fill_type="solid")
    steel_blue_fill = PatternFill(start_color="2E75B6", end_color="2E75B6", fill_type="solid")
    green_total_fill = PatternFill(start_color="00B050", end_color="00B050", fill_type="solid")
    light_gray_fill = PatternFill(start_color="F2F2F2", end_color="F2F2F2", fill_type="solid")
    soft_green_fill = PatternFill(start_color="E2EFDA", end_color="E2EFDA", fill_type="solid")
    
    font_title = Font(name="Calibri", size=13, bold=True, color="000000")
    font_header = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
    font_bold_black = Font(name="Calibri", size=10, bold=True, color="000000")
    font_normal = Font(name="Calibri", size=10, color="000000")
    font_total = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
    
    thin_border_side = Side(border_style="thin", color="000000")
    thin_border = Border(left=thin_border_side, right=thin_border_side, top=thin_border_side, bottom=thin_border_side)
    
    align_center = Alignment(horizontal="center", vertical="center", wrap_text=True)
    align_left = Alignment(horizontal="left", vertical="center")
    align_right = Alignment(horizontal="right", vertical="center")
    
    # =============================================================
    # SHEET 1: BẢNG CHẤM CÔNG GỘP CA NGÀY & CA ĐÊM + TÍNH LƯƠNG
    # =============================================================
    ws1 = wb.create_sheet(title="Chấm Công Gộp & Tính Lương")
    ws1.views.sheetView[0].showGridLines = True
    
    # Header Tháng & Năm
    ws1['A1'] = "Tháng"
    ws1['B1'] = 12
    ws1['C1'] = "Năm"
    ws1['D1'] = 2026
    
    for c in ['A1', 'B1', 'C1', 'D1']:
        ws1[c].fill = cyan_fill
        ws1[c].font = Font(name="Calibri", size=11, bold=True)
        ws1[c].alignment = align_center
        ws1[c].border = thin_border
    
    # Titles Row 3
    ws1.merge_cells('A3:J3')
    ws1['A3'] = "BẢNG CHẤM CÔNG GỘP CA NGÀY & CA ĐÊM"
    ws1['A3'].fill = yellow_fill
    ws1['A3'].font = font_title
    ws1['A3'].alignment = align_center
    
    ws1.merge_cells('L3:O3')
    ws1['L3'] = "BẢNG CHUẨN TIỀN & TÍNH LƯƠNG CHI TIẾT"
    ws1['L3'].fill = yellow_fill
    ws1['L3'].font = font_title
    ws1['L3'].alignment = align_center
    
    for col_idx in range(1, 11):
        ws1.cell(row=3, column=col_idx).border = thin_border
    for col_idx in range(12, 16):
        ws1.cell(row=3, column=col_idx).border = thin_border
        
    left_headers = [
        ("A4", "Ngày", 15),
        ("B4", "Công chuẩn", 11),
        ("C4", "Giờ thực tế (100%)", 13),
        ("D4", "Ca đêm (130%)", 12),
        ("E4", "OT thường (150%)", 12),
        ("F4", "OT CN (200%)", 12),
        ("G4", "OT đêm thường (210%)", 13),
        ("H4", "OT đêm CN (270%)", 13),
        ("I4", "OT Lễ (300%)", 12),
        ("J4", "OT Lễ đêm (390%)", 13)
    ]
    for pos, text, width in left_headers:
        c = ws1[pos]
        c.value = text
        c.fill = steel_blue_fill
        c.font = font_header
        c.alignment = align_center
        c.border = thin_border
        ws1.column_dimensions[pos[0] if len(pos)==2 else pos[:2]].width = width
        
    ws1.column_dimensions['K'].width = 3  # Separator
    
    right_headers = [
        ("L4", "Thông tin", 26),
        ("M4", "Giá trị", 16),
        ("N4", "Thông số chuẩn", 18),
        ("O4", "Giá trị / Đơn vị", 18)
    ]
    for pos, text, width in right_headers:
        c = ws1[pos]
        c.value = text
        c.fill = steel_blue_fill
        c.font = font_header
        c.alignment = align_center
        c.border = thin_border
        col_letter = pos[0] if len(pos)==2 else pos[:2]
        ws1.column_dimensions[col_letter].width = width

    # Sample rows for 31 days
    for day in range(1, 32):
        r = day + 4
        ws1[f'A{r}'] = f'=IF(DAY(EOMONTH(DATE($D$1,$B$1,1),0))>={day}, {day} & " - " & CHOOSE(WEEKDAY(DATE($D$1,$B$1,{day})), "Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"), "")'
        ws1[f'A{r}'].alignment = align_center
        ws1[f'A{r}'].font = font_normal
        ws1[f'A{r}'].border = thin_border
        
        ws1[f'B{r}'] = f'=IF($A{r}="","",IF(WEEKDAY(DATE($D$1,$B$1,{day}))=1,"",8))'
        ws1[f'B{r}'].alignment = align_center
        ws1[f'B{r}'].font = font_normal
        ws1[f'B{r}'].border = thin_border
        
        is_sun = (day in [6, 13, 20, 27])
        c_val = "" if is_sun else 8
        ot150_val = 3 if day not in [3, 10, 17, 24] else ("" if is_sun else "")
        ot200_val = 11 if day in [3, 10, 17] else ""
        
        cols_day = [
            ('C', c_val),
            ('D', ""),
            ('E', ot150_val),
            ('F', ot200_val),
            ('G', ""),
            ('H', ""),
            ('I', ""),
            ('J', "")
        ]
        for col_letter, val in cols_day:
            cell = ws1[f'{col_letter}{r}']
            cell.value = val
            cell.alignment = align_center
            cell.font = font_normal
            cell.border = thin_border

    # Row 36: TỔNG CỘNG
    r_total = 36
    ws1[f'A{r_total}'] = "TỔNG CỘNG"
    ws1[f'A{r_total}'].font = font_total
    ws1[f'A{r_total}'].fill = green_total_fill
    ws1[f'A{r_total}'].alignment = align_center
    ws1[f'A{r_total}'].border = thin_border
    
    for col_letter in ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']:
        cell = ws1[f'{col_letter}{r_total}']
        cell.value = f'=SUM({col_letter}5:{col_letter}35)'
        cell.font = font_total
        cell.fill = green_total_fill
        cell.alignment = align_center
        cell.border = thin_border
        cell.number_format = "#,##0.##"

    # RIGHT SALARY TABLE (L5 to O40)
    ws1['L5'] = "Họ và tên"
    ws1['M5'] = "Nguyễn Công Thịnh"
    ws1['N5'] = "Ngày công chuẩn"
    ws1['O5'] = '=NETWORKDAYS.INTL(DATE($D$1,$B$1,1), EOMONTH(DATE($D$1,$B$1,1),0), 11)'
    
    ws1['L6'] = "Bộ phận"
    ws1['M6'] = "工程部"
    ws1['N6'] = "Số giờ tiêu chuẩn"
    ws1['O6'] = '=O5*8'
    
    ws1['L7'] = "Lương cơ bản (LCB)"
    ws1['M7'] = 6300000
    ws1['N7'] = "Đơn giá giờ"
    ws1['O7'] = '=O9/O6'
    
    ws1['L8'] = "Phụ cấp chức vụ"
    ws1['M8'] = 2450000
    ws1['N8'] = "Hệ số KPI"
    ws1['O8'] = 1
    
    ws1['L9'] = "Thâm niên"
    ws1['M9'] = 100000
    ws1['N9'] = "Lương đóng BH"
    ws1['O9'] = '=SUM(M7:M9)'

    for r in range(5, 10):
        for c in ['L', 'M', 'N', 'O']:
            cell = ws1[f'{c}{r}']
            cell.border = thin_border
            if c in ['L', 'N']:
                cell.font = font_bold_black
                cell.alignment = align_left
            else:
                cell.font = font_normal
                if c == 'M' and r in [7, 8, 9]:
                    cell.alignment = align_right
                    cell.number_format = "#,##0"
                elif c == 'O':
                    cell.alignment = align_right
                    cell.number_format = "#,##0" if r != 8 else "0"
                else:
                    cell.alignment = align_center

    ws1['L10'] = "MỤC TÍNH LƯƠNG"
    ws1['M10'] = "CÔNG THỨC / ĐƠN GIÁ"
    ws1['N10'] = "SỐ GIỜ (TỪ BẢNG CÔNG)"
    ws1['O10'] = "THÀNH TIỀN (VNĐ)"
    for c in ['L10', 'M10', 'N10', 'O10']:
        ws1[c].fill = steel_blue_fill
        ws1[c].font = font_header
        ws1[c].alignment = align_center
        ws1[c].border = thin_border

    # I. LƯƠNG THỜI GIAN LÀM VIỆC (100%) = Đơn giá 1 giờ x Giờ thực tế
    ws1['L11'] = "I. LƯƠNG LÀM THỰC TẾ (100%)"
    ws1['M11'] = "=O$7"
    ws1['N11'] = "=C36"
    ws1['O11'] = "=ROUND(O$7*N11, 0)"

    # II. LÀM THÊM GIỜ & CA ĐÊM (OT) = Đơn giá 1 giờ x Số giờ x % OT
    ws1['L12'] = "II. LÀM THÊM GIỜ & CA ĐÊM"
    ws1['M12'] = ""
    ws1['N12'] = "=SUM(N13:N19)"
    ws1['O12'] = "=SUM(O13:O19)"

    ws1['L13'] = "1. Phụ cấp ca đêm (130%)"
    ws1['M13'] = "=O$7*1.30"
    ws1['N13'] = "=D36"
    ws1['O13'] = "=ROUND(O$7*1.30*N13, 0)"

    ws1['L14'] = "2. Tăng ca ngày thường (150%)"
    ws1['M14'] = "=O$7*1.50"
    ws1['N14'] = "=E36"
    ws1['O14'] = "=ROUND(O$7*1.50*N14, 0)"

    ws1['L15'] = "3. Tăng ca Chủ Nhật ngày (200%)"
    ws1['M15'] = "=O$7*2.00"
    ws1['N15'] = "=F36"
    ws1['O15'] = "=ROUND(O$7*2.00*N15, 0)"

    ws1['L16'] = "4. Tăng ca đêm ngày thường (210%)"
    ws1['M16'] = "=O$7*2.10"
    ws1['N16'] = "=G36"
    ws1['O16'] = "=ROUND(O$7*2.10*N16, 0)"

    ws1['L17'] = "5. Tăng ca đêm Chủ Nhật (270%)"
    ws1['M17'] = "=O$7*2.70"
    ws1['N17'] = "=H36"
    ws1['O17'] = "=ROUND(O$7*2.70*N17, 0)"

    ws1['L18'] = "6. Tăng ca ngày Lễ (300%)"
    ws1['M18'] = "=O$7*3.00"
    ws1['N18'] = "=I36"
    ws1['O18'] = "=ROUND(O$7*3.00*N18, 0)"

    ws1['L19'] = "7. Tăng ca đêm ngày Lễ (390%)"
    ws1['M19'] = "=O$7*3.90"
    ws1['N19'] = "=J36"
    ws1['O19'] = "=ROUND(O$7*3.90*N19, 0)"

    # III. CÁC KHOẢN TRỢ CẤP (Bao gồm đầy đủ theo ảnh mới)
    ws1['L20'] = "III. CÁC KHOẢN TRỢ CẤP"
    ws1['M20'] = ""
    ws1['N20'] = "Tiêu chuẩn"
    ws1['O20'] = "=SUM(O21:O28)"

    ws1['L21'] = "1. Trợ cấp xăng xe"
    ws1['M21'] = "Cố định"
    ws1['N21'] = ""
    ws1['O21'] = 500000

    ws1['L22'] = "2. Trợ cấp nhà ở"
    ws1['M22'] = "Cố định"
    ws1['N22'] = ""
    ws1['O22'] = 500000

    ws1['L23'] = "3. Trợ cấp con nhỏ"
    ws1['M23'] = ""
    ws1['N23'] = ""
    ws1['O23'] = 0

    ws1['L24'] = "4. Trợ cấp PCCC/ Trợ cấp an toàn"
    ws1['M24'] = "/"
    ws1['N24'] = ""
    ws1['O24'] = 0

    ws1['L25'] = "5. Trợ cấp ca đêm"
    ws1['M25'] = ""
    ws1['N25'] = ""
    ws1['O25'] = 780000

    ws1['L26'] = "6. Tiền ăn ca đêm / Tiền 10K ca ngày"
    ws1['M26'] = ""
    ws1['N26'] = ""
    ws1['O26'] = 650000

    ws1['L27'] = "7. Trợ cấp kinh nguyệt"
    ws1['M27'] = ""
    ws1['N27'] = ""
    ws1['O27'] = 0

    ws1['L28'] = "8. Trợ cấp khác"
    ws1['M28'] = ""
    ws1['N28'] = ""
    ws1['O28'] = 0

    # IV. CÁC KHOẢN THƯỞNG
    ws1['L29'] = "IV. CÁC KHOẢN THƯỞNG"
    ws1['M29'] = ""
    ws1['N29'] = "Tiêu chuẩn"
    ws1['O29'] = "=SUM(O30:O31)"

    ws1['L30'] = "1. Tiền thưởng chuyên cần"
    ws1['M30'] = '=IF((C36+D36)>=O6, "Đủ công", "Thiếu công")'
    ws1['N30'] = ""
    ws1['O30'] = '=IF((C36+D36)>=O6, 600000, 0)'

    ws1['L31'] = "2. Tiền thưởng thành tích KPI"
    ws1['M31'] = "Hệ số: 1"
    ws1['N31'] = ""
    ws1['O31'] = 3050000

    # V. TỔNG THU NHẬP
    ws1['L32'] = "V. TỔNG THU NHẬP (I+II+III+IV)"
    ws1['M32'] = ""
    ws1['N32'] = ""
    ws1['O32'] = "=O11+O12+O20+O29"

    # VI. CÁC KHOẢN GIẢM TRỪ
    ws1['L33'] = "VI. CÁC KHOẢN GIẢM TRỪ"
    ws1['M33'] = "Tỷ lệ"
    ws1['N33'] = "Lương đóng BH"
    ws1['O33'] = "=SUM(O34:O38)"

    ws1['L34'] = "1. Bảo hiểm xã hội (BHXH - 8%)"
    ws1['M34'] = 0.08
    ws1['N34'] = "=O$9"
    ws1['O34'] = "=ROUND(M34*N34, 0)"

    ws1['L35'] = "2. Bảo hiểm y tế (BHYT - 1.5%)"
    ws1['M35'] = 0.015
    ws1['N35'] = "=O$9"
    ws1['O35'] = "=ROUND(M35*N35, 0)"

    ws1['L36'] = "3. Bảo hiểm thất nghiệp (BHTN - 1%)"
    ws1['M36'] = 0.01
    ws1['N36'] = "=O$9"
    ws1['O36'] = "=ROUND(M36*N36, 0)"

    ws1['L37'] = "4. Kinh phí công đoàn (0.5%)"
    ws1['M37'] = 0.005
    ws1['N37'] = "=O$9"
    ws1['O37'] = "=ROUND(M37*N37, 0)"

    ws1['L38'] = "5. Thuế thu nhập cá nhân (TNCN)"
    ws1['M38'] = "0% (Miễn thuế)"
    ws1['N38'] = "-"
    ws1['O38'] = 0

    # TỔNG CÁC KHOẢN GIẢM TRỪ
    ws1['L39'] = "TỔNG CÁC KHOẢN GIẢM TRỪ"
    ws1['M39'] = ""
    ws1['N39'] = ""
    ws1['O39'] = "=SUM(O34:O38)"

    # VII. THỰC LĨNH / THỰC NHẬN
    ws1.merge_cells('L40:N40')
    ws1['L40'] = "VII. THỰC LĨNH / THỰC NHẬN"
    ws1['O40'] = "=O32-O39"

    bold_rows = [11, 12, 20, 29, 32, 33, 39]
    for r in range(11, 41):
        for c in ['L', 'M', 'N', 'O']:
            cell = ws1[f'{c}{r}']
            cell.border = thin_border
            if r in bold_rows:
                cell.font = font_bold_black
            else:
                cell.font = font_normal
            if c == 'L':
                cell.alignment = align_left
            elif c in ['M', 'N', 'O']:
                if r in [34, 35, 36, 37] and c == 'M':
                    cell.alignment = align_center
                    cell.number_format = "0.00%"
                elif r in [34, 35, 36, 37] and c == 'N':
                    cell.alignment = align_right
                    cell.number_format = "#,##0"
                elif c == 'O':
                    cell.alignment = align_right
                    cell.number_format = "#,##0"
                elif c == 'M' and r in [11, 13, 14, 15, 16, 17, 18, 19]:
                    cell.alignment = align_right
                    cell.number_format = "#,##0"
                elif c == 'N' and r in [11, 12, 13, 14, 15, 16, 17, 18, 19]:
                    cell.alignment = align_center
                    cell.number_format = "#,##0.##"
                else:
                    cell.alignment = align_center

    for c in ['L40', 'M40', 'N40', 'O40']:
        ws1[c].fill = green_total_fill
        ws1[c].font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        ws1[c].border = thin_border
    ws1['L40'].alignment = align_center
    ws1['O40'].alignment = align_right
    ws1['O40'].number_format = "#,##0"

    # Conditional formatting for Sundays (A5:J35)
    from openpyxl.formatting.rule import FormulaRule
    green_rule = FormulaRule(
        formula=['ISNUMBER(SEARCH("Chủ Nhật", $A5))'],
        stopIfTrue=True,
        fill=green_total_fill,
        font=Font(name="Calibri", size=10, bold=True, color="FFFFFF")
    )
    ws1.conditional_formatting.add("A5:J35", green_rule)

    # =============================================================
    # SHEET 2: BẢNG THỐNG KÊ TỔNG TIỀN 12 THÁNG TRONG NĂM
    # =============================================================
    ws2 = wb.create_sheet(title="Thống Kê Tổng Tiền 12 Tháng")
    ws2.views.sheetView[0].showGridLines = True
    
    ws2.merge_cells('A1:J1')
    ws2['A1'] = "BẢNG THỐNG KÊ TỔNG TIỀN LƯƠNG 12 THÁNG NĂM 2026"
    ws2['A1'].font = Font(name="Calibri", size=14, bold=True, color="1F4E78")
    ws2['A1'].alignment = align_center
    ws2['A1'].fill = cyan_fill
    for col_idx in range(1, 11):
        ws2.cell(row=1, column=col_idx).border = thin_border

    headers_summary = [
        ("A", "Tháng", 12),
        ("B", "Công chuẩn", 13),
        ("C", "Giờ thực tế", 13),
        ("D", "Tổng giờ OT", 13),
        ("E", "Lương thời gian", 16),
        ("F", "Tiền OT", 16),
        ("G", "Trợ cấp & Thưởng", 16),
        ("H", "Tổng thu nhập", 18),
        ("I", "Giảm trừ bảo hiểm", 18),
        ("J", "THỰC LĨNH (VNĐ)", 20)
    ]
    for col_letter, text, width in headers_summary:
        c = ws2[f'{col_letter}3']
        c.value = text
        c.fill = steel_blue_fill
        c.font = font_header
        c.alignment = align_center
        c.border = thin_border
        ws2.column_dimensions[col_letter].width = width

    monthly_standards = [
        (1, 26, 208, 90, 8522160, 6075000, 4650000, 19247160, 973500, 18273660),
        (2, 24, 192, 80, 7866624, 5400000, 4650000, 17916624, 973500, 16943124),
        (3, 26, 208, 100, 8522160, 6750000, 4650000, 19922160, 973500, 18948660),
        (4, 26, 208, 95, 8522160, 6412500, 4650000, 19584660, 973500, 18611160),
        (5, 26, 208, 110, 8522160, 7425000, 4650000, 20597160, 973500, 19623660),
        (6, 26, 208, 105, 8522160, 7087500, 4650000, 20259660, 973500, 19286160),
        (7, 27, 216, 115, 8850000, 7749975, 4650000, 21249975, 973500, 20276475),
        (8, 26, 208, 110, 8522160, 7425000, 4650000, 20597160, 973500, 19623660),
        (9, 26, 208, 90, 8522160, 6075000, 4650000, 19247160, 973500, 18273660),
        (10, 27, 216, 120, 8850000, 8086932, 4650000, 21586932, 973500, 20613432),
        (11, 25, 200, 144, 8200000, 7150000, 4650000, 20000000, 973500, 19026500), # Nov
        (12, 27, 216, 114, 8850000, 7682292, 4650000, 21182292, 973500, 20208792)  # Dec
    ]

    for idx, row_data in enumerate(monthly_standards):
        r = idx + 4
        m, std_days, actual_h, ot_h, day_wage, ot_wage, bon_allow, gross, ded, net = row_data
        
        ws2[f'A{r}'] = f"Tháng {m}"
        ws2[f'B{r}'] = std_days
        ws2[f'C{r}'] = actual_h
        ws2[f'D{r}'] = ot_h
        ws2[f'E{r}'] = day_wage
        ws2[f'F{r}'] = ot_wage
        ws2[f'G{r}'] = bon_allow
        ws2[f'H{r}'] = gross
        ws2[f'I{r}'] = ded
        ws2[f'J{r}'] = net

        for col_letter in ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']:
            cell = ws2[f'{col_letter}{r}']
            cell.border = thin_border
            cell.font = font_normal
            if col_letter in ['A', 'B']:
                cell.alignment = align_center
            elif col_letter in ['C', 'D']:
                cell.alignment = align_center
                cell.number_format = "#,##0"
            else:
                cell.alignment = align_right
                cell.number_format = "#,##0"
            if col_letter == 'J':
                cell.fill = soft_green_fill
                cell.font = font_bold_black

    # Row 16: TỔNG CỘNG CẢ NĂM
    r_sum = 16
    ws2[f'A{r_sum}'] = "TỔNG CẢ NĂM"
    ws2[f'A{r_sum}'].font = font_total
    ws2[f'A{r_sum}'].fill = green_total_fill
    ws2[f'A{r_sum}'].alignment = align_center
    ws2[f'A{r_sum}'].border = thin_border

    for col_letter in ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']:
        cell = ws2[f'{col_letter}{r_sum}']
        cell.value = f'=SUM({col_letter}4:{col_letter}15)'
        cell.font = font_total
        cell.fill = green_total_fill
        cell.border = thin_border
        if col_letter in ['B', 'C', 'D']:
            cell.alignment = align_center
            cell.number_format = "#,##0"
        else:
            cell.alignment = align_right
            cell.number_format = "#,##0"

    # Row 17: TRUNG BÌNH THÁNG
    r_avg = 17
    ws2[f'A{r_avg}'] = "TRUNG BÌNH / THÁNG"
    ws2[f'A{r_avg}'].font = font_bold_black
    ws2[f'A{r_avg}'].fill = light_gray_fill
    ws2[f'A{r_avg}'].alignment = align_center
    ws2[f'A{r_avg}'].border = thin_border

    for col_letter in ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']:
        cell = ws2[f'{col_letter}{r_avg}']
        cell.value = f'=AVERAGE({col_letter}4:{col_letter}15)'
        cell.font = font_bold_black
        cell.fill = light_gray_fill
        cell.border = thin_border
        if col_letter in ['B', 'C', 'D']:
            cell.alignment = align_center
            cell.number_format = "0.0"
        else:
            cell.alignment = align_right
            cell.number_format = "#,##0"

    # =============================================================
    # SHEET 3: HƯỚNG DẪN SỬ DỤNG
    # =============================================================
    ws3 = wb.create_sheet(title="Hướng Dẫn Sử Dụng")
    ws3.views.sheetView[0].showGridLines = True
    
    ws3.column_dimensions['A'].width = 5
    ws3.column_dimensions['B'].width = 28
    ws3.column_dimensions['C'].width = 80
    
    ws3['B2'] = "HƯỚNG DẪN BẢNG CHẤM CÔNG GỘP & BẢNG THỐNG KÊ 12 THÁNG"
    ws3['B2'].font = Font(name="Calibri", size=14, bold=True, color="1F4E78")
    
    guides = [
        ("1. Công thức OT chuẩn", "Tiền OT = Đơn giá 1 giờ x Số giờ OT x % OT. Ví dụ: OT 150% = 40.972 x Số giờ x 1.5; OT 200% = 40.972 x Số giờ x 2.0; OT 130% = 40.972 x Số giờ x 1.3."),
        ("2. Tích chọn Ca Ngày / Ca Đêm", "Bấm nút ☀️ Ngày để tự điền 8h thực tế + 3h OT; bấm 🌙 Đêm để tự điền 2h ngày + 6h đêm + 2h OT thường + 1.75h OT đêm; bấm ⚪ Nghỉ để xóa giờ. Toàn bộ các ô số giờ vẫn có thể gõ sửa trực tiếp theo ý muốn."),
        ("3. Tự Động Sinh Ngày", "Khi đổi ô Tháng (B1) hoặc Năm (D1), danh sách ngày từ ngày 1 đến hết tháng tự động sinh theo lịch chính xác, nhận biết năm nhuận và tự động tô màu Chủ Nhật."),
        ("4. Đầy Đủ Phụ Cấp Ca Đêm", "Tự động gợi ý trợ cấp ca đêm (780.000đ tương ứng 26 đêm x 30k) và tiền ăn ca đêm (650.000đ tương ứng 26 đêm x 25k)."),
        ("5. Bảng Thống Kê 12 Tháng", "Tại Sheet 'Thống Kê Tổng Tiền 12 Tháng', toàn bộ 12 tháng được thống kê chi tiết, tính tổng cả năm và trung bình mỗi tháng."),
        ("6. Công thức Thực Lĩnh", "Thực lĩnh (VII) = Tổng thu nhập (V) - Tổng các khoản giảm trừ bảo hiểm & thuế (VI).")
    ]
    
    row_idx = 4
    for title, desc in guides:
        ws3[f'B{row_idx}'] = title
        ws3[f'B{row_idx}'].font = font_bold_black
        ws3[f'B{row_idx}'].alignment = align_left
        ws3[f'B{row_idx}'].border = thin_border
        ws3[f'B{row_idx}'].fill = light_gray_fill
        
        ws3[f'C{row_idx}'] = desc
        ws3[f'C{row_idx}'].font = font_normal
        ws3[f'C{row_idx}'].alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
        ws3[f'C{row_idx}'].border = thin_border
        row_idx += 1

    if default_sheet.title in wb.sheetnames and len(wb.sheetnames) > 1:
        wb.remove(default_sheet)
        
    output_path = "Bang_Cham_Cong_Tu_Dong.xlsx"
    wb.save(output_path)
    print(f"Đã tạo file Excel thành công: {output_path}")

if __name__ == "__main__":
    create_timesheet_workbook()
