package com.mulaerp.common.export;

import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Shared builder for the plain, printable tabular PDF/CSV documents WP5 adds across accounting
 * and reports exports (P&amp;L, balance sheet, sales, inventory). Every document gets a company
 * name, report title, an optional period/summary line, and a generated-at timestamp - these are
 * meant for LHDN/audit submission, so there's no styling beyond a plain header row.
 */
public final class PdfReportUtil {

    private static final DateTimeFormatter GENERATED_AT_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final Color HEADER_BLUE = new Color(37, 99, 235); // Tailwind blue-600, matches the frontend design system

    private PdfReportUtil() {
    }

    public static byte[] buildTableReport(String companyName, String reportTitle, String periodLabel,
                                           List<String> headers, List<List<String>> rows,
                                           List<String> totalsRow) throws IOException {
        Document document = new Document(PageSize.A4, 36, 36, 54, 36);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            PdfWriter.getInstance(document, out);
            document.open();

            Font companyFont = new Font(Font.HELVETICA, 12, Font.BOLD);
            Font titleFont = new Font(Font.HELVETICA, 16, Font.BOLD);
            Font metaFont = new Font(Font.HELVETICA, 9, Font.NORMAL, Color.DARK_GRAY);
            Font headerFont = new Font(Font.HELVETICA, 9, Font.BOLD, Color.WHITE);
            Font cellFont = new Font(Font.HELVETICA, 9, Font.NORMAL);
            Font totalFont = new Font(Font.HELVETICA, 9, Font.BOLD);

            document.add(new Paragraph(companyName, companyFont));

            Paragraph title = new Paragraph(reportTitle, titleFont);
            title.setSpacingBefore(4);
            document.add(title);

            if (periodLabel != null && !periodLabel.isBlank()) {
                Paragraph period = new Paragraph(periodLabel, metaFont);
                period.setSpacingBefore(4);
                document.add(period);
            }

            Paragraph generatedAt = new Paragraph("Generated at: " + LocalDateTime.now().format(GENERATED_AT_FORMAT), metaFont);
            generatedAt.setSpacingBefore(2);
            generatedAt.setSpacingAfter(14);
            document.add(generatedAt);

            PdfPTable table = new PdfPTable(headers.size());
            table.setWidthPercentage(100);

            for (String header : headers) {
                PdfPCell cell = new PdfPCell(new Phrase(header, headerFont));
                cell.setBackgroundColor(HEADER_BLUE);
                cell.setPadding(5);
                table.addCell(cell);
            }

            for (List<String> row : rows) {
                for (int i = 0; i < row.size(); i++) {
                    PdfPCell cell = new PdfPCell(new Phrase(row.get(i), cellFont));
                    cell.setPadding(4);
                    if (i > 0) {
                        cell.setHorizontalAlignment(Element.ALIGN_RIGHT);
                    }
                    table.addCell(cell);
                }
            }

            if (totalsRow != null) {
                for (int i = 0; i < totalsRow.size(); i++) {
                    PdfPCell cell = new PdfPCell(new Phrase(totalsRow.get(i), totalFont));
                    cell.setPadding(4);
                    cell.setBackgroundColor(new Color(241, 245, 249)); // slate-100
                    if (i > 0) {
                        cell.setHorizontalAlignment(Element.ALIGN_RIGHT);
                    }
                    table.addCell(cell);
                }
            }

            document.add(table);
            document.close();
            return out.toByteArray();
        } catch (DocumentException e) {
            throw new IOException("Failed to generate PDF report", e);
        }
    }

    public static byte[] buildCsv(List<String> headers, List<List<String>> rows, List<String> totalsRow) {
        StringBuilder sb = new StringBuilder();
        appendCsvRow(sb, headers);
        for (List<String> row : rows) {
            appendCsvRow(sb, row);
        }
        if (totalsRow != null) {
            appendCsvRow(sb, totalsRow);
        }
        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    private static void appendCsvRow(StringBuilder sb, List<String> values) {
        for (int i = 0; i < values.size(); i++) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append(csvEscape(values.get(i)));
        }
        sb.append('\n');
    }

    private static String csvEscape(String value) {
        if (value == null) {
            return "";
        }
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }

    public static String money(BigDecimal value) {
        return value == null ? "0.00" : value.setScale(2, RoundingMode.HALF_UP).toString();
    }
}
