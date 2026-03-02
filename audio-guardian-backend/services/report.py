"""
Forensic Report PDF Generator
Generates a professional, court-admissible style forensic report.
"""

import io
import uuid
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT


# ── Color palette ────────────────────────────────────────────────────────────
NAVY = colors.HexColor("#0a0f1e")
BLUE = colors.HexColor("#00d4ff")
GREEN = colors.HexColor("#00c96e")
AMBER = colors.HexColor("#fbbf24")
RED = colors.HexColor("#ef4444")
LIGHT_GRAY = colors.HexColor("#f1f5f9")
MID_GRAY = colors.HexColor("#64748b")


def _verdict_color(verdict: str):
    v = verdict.upper()
    if "AUTHENTIC" in v:
        return GREEN
    if "SUSPICIOUS" in v:
        return AMBER
    return RED


def _status_color(status: str):
    s = status.upper()
    if s == "PASS":
        return GREEN
    if s == "SUSPICIOUS":
        return AMBER
    return RED


def generate(analysis_result: dict) -> bytes:
    """
    Generate a PDF forensic report from the analysis result dict.
    Returns the PDF as bytes.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle("title", parent=styles["Normal"],
                                  fontSize=20, textColor=NAVY, spaceAfter=4,
                                  fontName="Helvetica-Bold", alignment=TA_CENTER)
    subtitle_style = ParagraphStyle("subtitle", parent=styles["Normal"],
                                    fontSize=10, textColor=MID_GRAY, spaceAfter=2,
                                    fontName="Helvetica", alignment=TA_CENTER)
    section_style = ParagraphStyle("section", parent=styles["Normal"],
                                   fontSize=13, textColor=NAVY, spaceBefore=16,
                                   spaceAfter=6, fontName="Helvetica-Bold")
    body_style = ParagraphStyle("body", parent=styles["Normal"],
                                fontSize=9, textColor=colors.HexColor("#1e293b"),
                                spaceAfter=4, fontName="Helvetica", leading=14)
    mono_style = ParagraphStyle("mono", parent=styles["Normal"],
                                fontSize=8, textColor=colors.HexColor("#374151"),
                                fontName="Courier", leading=12)
    small_gray = ParagraphStyle("smallgray", parent=styles["Normal"],
                                fontSize=8, textColor=MID_GRAY,
                                fontName="Helvetica")

    elements = []

    # ── Header ────────────────────────────────────────────────────────────────
    elements.append(Paragraph("🔒 AUDIONOTARY", title_style))
    elements.append(Paragraph("FORENSIC AUDIO ANALYSIS CERTIFICATE", subtitle_style))
    elements.append(HRFlowable(width="100%", thickness=2, color=BLUE, spaceAfter=12))

    # ── Case info table ───────────────────────────────────────────────────────
    case_id = str(uuid.uuid4()).upper()
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    meta = analysis_result.get("file_metadata", {})
    verdict = analysis_result.get("verdict", "UNKNOWN")
    trust_score = analysis_result.get("trust_score", 0)

    case_data = [
        ["Case ID", case_id],
        ["Analysis Date", now],
        ["Analyzer Version", "AudioNotary v1.0.0"],
        ["File Name", meta.get("filename", "N/A")],
        ["File Size", f"{meta.get('file_size_bytes', 0):,} bytes"],
        ["Duration", f"{meta.get('duration_sec', 0):.2f} seconds"],
        ["Sample Rate", f"{meta.get('sample_rate', 0):,} Hz"],
        ["Format", meta.get("format", "N/A")],
        ["SHA-256 Hash", meta.get("file_hash", "N/A")],
    ]

    case_table = Table(case_data, colWidths=[4 * cm, 13 * cm])
    case_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Courier"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("TEXTCOLOR", (0, 0), (0, -1), MID_GRAY),
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT_GRAY),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, LIGHT_GRAY]),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(case_table)
    elements.append(Spacer(1, 16))

    # ── Verdict banner ────────────────────────────────────────────────────────
    elements.append(Paragraph("EXECUTIVE VERDICT", section_style))
    v_color = _verdict_color(verdict)

    verdict_data = [
        [
            Paragraph(f"<b>{verdict}</b>", ParagraphStyle(
                "v", fontSize=22, textColor=v_color,
                fontName="Helvetica-Bold", alignment=TA_CENTER
            )),
            Paragraph(f"<b>Trust Score</b><br/><font size=28 color='{v_color.hexval()}'>{trust_score}</font><font size=12>/100</font>",
                      ParagraphStyle("ts", fontName="Helvetica", alignment=TA_CENTER, leading=28))
        ]
    ]
    verdict_table = Table(verdict_data, colWidths=[9.5 * cm, 7.5 * cm])
    verdict_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 2, v_color),
        ("LINEAFTER", (0, 0), (0, 0), 1, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
    ]))
    elements.append(verdict_table)
    elements.append(Spacer(1, 8))

    # Executive summary paragraph
    n_anomalies = sum(1 for l in analysis_result.get("layers", []) if l.get("anomaly_detected"))
    n_layers = len(analysis_result.get("layers", []))
    summary_text = (
        f"AudioNotary performed a {n_layers}-layer forensic trust audit on the submitted audio file. "
        f"<b>{n_anomalies} of {n_layers} forensic layers reported anomalies.</b> "
        f"The overall Trust Score is {trust_score}/100, yielding a verdict of <b>{verdict}</b>. "
        f"This certificate is generated at the time of analysis and reflects the state of the file "
        f"as received. Any subsequent modification of the file will invalidate this certificate."
    )
    elements.append(Paragraph(summary_text, body_style))
    elements.append(Spacer(1, 8))

    # ── Layer-by-layer findings ───────────────────────────────────────────────
    elements.append(Paragraph("FORENSIC LAYER FINDINGS", section_style))

    for layer in analysis_result.get("layers", []):
        layer_name = layer.get("layer", "Unknown")
        layer_score = layer.get("score", 0)
        layer_status = layer.get("status", "UNKNOWN")
        s_color = _status_color(layer_status)

        layer_header = [
            [
                Paragraph(f"<b>{layer_name}</b>",
                           ParagraphStyle("lh", fontName="Helvetica-Bold", fontSize=10, textColor=NAVY)),
                Paragraph(f"Score: <b>{layer_score}/100</b>",
                           ParagraphStyle("ls", fontName="Helvetica", fontSize=9, alignment=TA_RIGHT)),
                Paragraph(f"<b>{layer_status}</b>",
                           ParagraphStyle("lst", fontName="Helvetica-Bold", fontSize=10,
                                          textColor=s_color, alignment=TA_RIGHT)),
            ]
        ]
        header_table = Table(layer_header, colWidths=[9 * cm, 4 * cm, 4 * cm])
        header_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), LIGHT_GRAY),
            ("BOX", (0, 0), (-1, -1), 1, s_color),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ]))
        elements.append(header_table)

        # Sub-metrics
        sub_data = [["Sub-Metric", "Score", "Finding"]]
        for metric_key, metric_val in layer.get("sub_metrics", {}).items():
            metric_name = metric_key.replace("_", " ").title()
            m_score = metric_val.get("score", "-")
            m_detail = metric_val.get("detail", "")[:120]
            sub_data.append([metric_name, str(m_score), m_detail])

        if len(sub_data) > 1:
            sub_table = Table(sub_data, colWidths=[4 * cm, 1.5 * cm, 11.5 * cm])
            sub_table.setStyle(TableStyle([
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ]))
            elements.append(sub_table)

        elements.append(Spacer(1, 10))

    # ── Splice anomaly timeline ───────────────────────────────────────────────
    splice_layer = next((l for l in analysis_result.get("layers", [])
                        if "Cross-Modal" in l.get("layer", "")), None)
    if splice_layer:
        splice_times = (splice_layer.get("sub_metrics", {})
                        .get("splice_detection", {})
                        .get("splice_timestamps", []))
        if splice_times:
            elements.append(Paragraph("ANOMALY TIMELINE", section_style))
            tl_data = [["Timestamp", "Event", "Severity"]]
            for t in splice_times:
                tl_data.append([f"{t:.2f}s", "Spectral discontinuity — possible splice point", "HIGH"])
            tl_table = Table(tl_data, colWidths=[2.5 * cm, 12 * cm, 2.5 * cm])
            tl_table.setStyle(TableStyle([
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fff7ed")]),
                ("TEXTCOLOR", (2, 1), (2, -1), RED),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ]))
            elements.append(tl_table)
            elements.append(Spacer(1, 12))

    # ── Certification footer ──────────────────────────────────────────────────
    elements.append(HRFlowable(width="100%", thickness=1, color=BLUE, spaceAfter=8))
    cert_text = (
        f"<b>CERTIFICATION:</b> This forensic analysis was performed by <b>AudioNotary v1.0.0</b> "
        f"on {now}. The SHA-256 integrity hash of the analyzed file has been recorded above. "
        f"Any alteration to the audio file subsequent to this analysis will produce a different hash "
        f"and invalidate this certificate. This report is generated for informational purposes. "
        f"For use as legal evidence, please consult a certified digital forensics professional."
    )
    elements.append(Paragraph(cert_text, small_gray))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(f"Case ID: {case_id} | AudioNotary © 2025",
                               ParagraphStyle("footer", parent=styles["Normal"],
                                              fontSize=7, textColor=MID_GRAY,
                                              fontName="Helvetica", alignment=TA_CENTER)))

    doc.build(elements)
    return buffer.getvalue()