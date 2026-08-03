package com.mulaerp.invoice.service;

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
import com.mulaerp.company.entity.Company;
import com.mulaerp.company.service.CompanyNameResolver;
import com.mulaerp.invoice.dto.InvoiceDTO;
import com.mulaerp.invoice.dto.InvoiceItemDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

import static com.mulaerp.common.export.PdfReportUtil.money;

/**
 * Printable invoice PDF (WP5) - company header, invoice number/dates, line items, totals.
 * Reuses {@link InvoiceService} for the data; the company header is read from company settings
 * (CompanyNameResolver), falling back to a bare "Mula ERP" header when none is configured.
 */
@Service
@RequiredArgsConstructor
public class InvoicePdfService {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final Color HEADER_BLUE = new Color(37, 99, 235);

    private final InvoiceService invoiceService;
    private final CompanyNameResolver companyNameResolver;

    public byte[] generateInvoicePdf(UUID invoiceId) {
        InvoiceDTO invoice = invoiceService.getInvoiceById(invoiceId);
        Company company = companyNameResolver.resolveCompany();
        try {
            return build(invoice, company);
        } catch (DocumentException e) {
            throw new UncheckedIOException("Failed to generate invoice PDF", new IOException(e));
        }
    }

    private byte[] build(InvoiceDTO invoice, Company company) throws DocumentException {
        Document document = new Document(PageSize.A4, 36, 36, 54, 36);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        PdfWriter.getInstance(document, out);
        document.open();

        Font companyFont = new Font(Font.HELVETICA, 14, Font.BOLD);
        Font metaFont = new Font(Font.HELVETICA, 9, Font.NORMAL, Color.DARK_GRAY);
        Font titleFont = new Font(Font.HELVETICA, 18, Font.BOLD);
        Font labelFont = new Font(Font.HELVETICA, 9, Font.NORMAL, Color.DARK_GRAY);
        Font valueFont = new Font(Font.HELVETICA, 10, Font.NORMAL);
        Font headerFont = new Font(Font.HELVETICA, 9, Font.BOLD, Color.WHITE);
        Font cellFont = new Font(Font.HELVETICA, 9, Font.NORMAL);
        Font totalFont = new Font(Font.HELVETICA, 10, Font.BOLD);

        String companyName = company != null ? company.getName() : "Mula ERP";
        document.add(new Paragraph(companyName, companyFont));
        if (company != null) {
            if (company.getAddress() != null && !company.getAddress().isBlank()) {
                document.add(new Paragraph(company.getAddress(), metaFont));
            }
            String contact = String.join(" | ",
                    java.util.stream.Stream.of(company.getPhone(), company.getEmail(), company.getTaxId() != null ? "Tax ID: " + company.getTaxId() : null)
                            .filter(s -> s != null && !s.isBlank())
                            .toArray(String[]::new));
            if (!contact.isBlank()) {
                document.add(new Paragraph(contact, metaFont));
            }
        }

        Paragraph title = new Paragraph("INVOICE", titleFont);
        title.setSpacingBefore(14);
        document.add(title);

        PdfPTable infoTable = new PdfPTable(2);
        infoTable.setWidthPercentage(100);
        infoTable.setSpacingBefore(8);
        infoTable.setSpacingAfter(10);
        addInfoCell(infoTable, "Invoice Number", invoice.getInvoiceNumber(), labelFont, valueFont);
        addInfoCell(infoTable, "Status", invoice.getStatus().name(), labelFont, valueFont);
        addInfoCell(infoTable, "Invoice Date", invoice.getInvoiceDate().format(DATE_FORMAT), labelFont, valueFont);
        addInfoCell(infoTable, "Due Date", invoice.getDueDate().format(DATE_FORMAT), labelFont, valueFont);
        addInfoCell(infoTable, "Bill To", invoice.getCustomerName(), labelFont, valueFont);
        addInfoCell(infoTable, "Generated At", LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")), labelFont, valueFont);
        document.add(infoTable);

        PdfPTable itemsTable = new PdfPTable(5);
        itemsTable.setWidthPercentage(100);
        itemsTable.setWidths(new float[]{4, 1, 1.3f, 1, 1.3f});
        for (String header : new String[]{"Description", "Qty", "Unit Price", "Tax Rate", "Total"}) {
            PdfPCell cell = new PdfPCell(new Phrase(header, headerFont));
            cell.setBackgroundColor(HEADER_BLUE);
            cell.setPadding(5);
            itemsTable.addCell(cell);
        }
        for (InvoiceItemDTO item : invoice.getItems()) {
            addCell(itemsTable, item.getDescription(), cellFont, false);
            addCell(itemsTable, String.valueOf(item.getQuantity()), cellFont, true);
            addCell(itemsTable, money(item.getUnitPrice()), cellFont, true);
            addCell(itemsTable, (item.getTaxRate() == null ? "0" : item.getTaxRate().setScale(2, RoundingMode.HALF_UP)) + "%", cellFont, true);
            addCell(itemsTable, money(item.getTotal()), cellFont, true);
        }
        document.add(itemsTable);

        PdfPTable totalsTable = new PdfPTable(2);
        totalsTable.setWidthPercentage(45);
        totalsTable.setHorizontalAlignment(Element.ALIGN_RIGHT);
        totalsTable.setSpacingBefore(10);
        addTotalsRow(totalsTable, "Subtotal", money(invoice.getSubtotal()), valueFont, valueFont);
        addTotalsRow(totalsTable, "Tax", money(invoice.getTax()), valueFont, valueFont);
        addTotalsRow(totalsTable, "Total", money(invoice.getTotal()), totalFont, totalFont);
        addTotalsRow(totalsTable, "Paid", money(invoice.getPaidAmount()), valueFont, valueFont);
        addTotalsRow(totalsTable, "Balance Due", money(invoice.getBalanceDue()), totalFont, totalFont);
        document.add(totalsTable);

        if (invoice.getNotes() != null && !invoice.getNotes().isBlank()) {
            Paragraph notesHeading = new Paragraph("Notes", labelFont);
            notesHeading.setSpacingBefore(16);
            document.add(notesHeading);
            document.add(new Paragraph(invoice.getNotes(), valueFont));
        }

        document.close();
        return out.toByteArray();
    }

    private void addInfoCell(PdfPTable table, String label, String value, Font labelFont, Font valueFont) {
        PdfPCell cell = new PdfPCell();
        cell.setBorder(0);
        cell.setPadding(3);
        Paragraph p = new Paragraph();
        p.add(new Phrase(label + ": ", labelFont));
        p.add(new Phrase(value == null ? "" : value, valueFont));
        cell.addElement(p);
        table.addCell(cell);
    }

    private void addCell(PdfPTable table, String value, Font font, boolean alignRight) {
        PdfPCell cell = new PdfPCell(new Phrase(value == null ? "" : value, font));
        cell.setPadding(4);
        if (alignRight) {
            cell.setHorizontalAlignment(Element.ALIGN_RIGHT);
        }
        table.addCell(cell);
    }

    private void addTotalsRow(PdfPTable table, String label, String value, Font labelFont, Font valueFont) {
        PdfPCell labelCell = new PdfPCell(new Phrase(label, labelFont));
        labelCell.setBorder(0);
        labelCell.setPadding(3);
        table.addCell(labelCell);

        PdfPCell valueCell = new PdfPCell(new Phrase(value, valueFont));
        valueCell.setBorder(0);
        valueCell.setPadding(3);
        valueCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
        table.addCell(valueCell);
    }
}
