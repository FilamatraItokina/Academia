import PDFDocument from 'pdfkit';
import type { ReportCardDetail } from './report-card.types.ts';

interface SchoolHeaderInfo {
  schoolName: string;
  address: string;
  phone: string;
  email: string;
}

export function buildReportCardPdfBuffer(
  detail: ReportCardDetail,
  school: SchoolHeaderInfo
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      info: {
        Title: `Bulletin scolaire - ${detail.studentLastName} ${detail.studentFirstName} - ${detail.termName}`,
        Author: school.schoolName,
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));

    const pageWidth = doc.page.width - 80; // 515.28pt
    const leftX = 40;

    // 1. En-tête de l'établissement
    doc
      .rect(leftX, 36, pageWidth, 64)
      .fillColor('#0F172A')
      .fill();

    doc
      .fillColor('#FFFFFF')
      .font('Helvetica-Bold')
      .fontSize(15)
      .text(school.schoolName.toUpperCase(), leftX + 16, 48, { width: 300 });

    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor('#CBD5E1')
      .text(
        [school.address, school.phone, school.email].filter(Boolean).join(' · ') ||
          'Établissement d’enseignement secondaire',
        leftX + 16,
        68,
        { width: 300 }
      );

    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor('#FFFFFF')
      .text('BULLETIN SCOLAIRE', leftX + 320, 48, {
        width: pageWidth - 336,
        align: 'right',
      });

    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#E2E8F0')
      .text(`${detail.termName} · ${detail.academicYearName}`, leftX + 320, 66, {
        width: pageWidth - 336,
        align: 'right',
      });

    // 2. Cartouche Élève & Vie scolaire
    let y = 114;
    doc
      .rect(leftX, y, pageWidth, 68)
      .strokeColor('#CBD5E1')
      .lineWidth(0.8)
      .stroke();

    doc
      .fillColor('#64748B')
      .font('Helvetica')
      .fontSize(8)
      .text('ÉLÈVE', leftX + 12, y + 10);

    doc
      .fillColor('#0F172A')
      .font('Helvetica-Bold')
      .fontSize(12)
      .text(`${detail.studentLastName} ${detail.studentFirstName}`, leftX + 12, y + 22);

    doc
      .fillColor('#475569')
      .font('Helvetica')
      .fontSize(8.5)
      .text(
        `Matricule : ${detail.studentMatricule}   ·   Né(e) le : ${detail.studentDateOfBirth}`,
        leftX + 12,
        y + 40
      );

    doc
      .fillColor('#64748B')
      .font('Helvetica')
      .fontSize(8)
      .text('CLASSE & ASSIDUITÉ', leftX + 305, y + 10);

    doc
      .fillColor('#0F172A')
      .font('Helvetica-Bold')
      .fontSize(10.5)
      .text(`${detail.className} (${detail.levelName})`, leftX + 305, y + 22);

    doc
      .fillColor('#475569')
      .font('Helvetica')
      .fontSize(8.5)
      .text(
        `Effectif : ${detail.totalStudents} élève(s)   ·   Absences : ${detail.absencesCount}   ·   Retards : ${detail.latesCount}`,
        leftX + 305,
        y + 40
      );

    // 3. Tableau des matières
    y += 84;
    const colWidths = {
      subject: 155,
      coeff: 40,
      studentAvg: 58,
      classAvg: 58,
      remark: pageWidth - 155 - 40 - 58 - 58,
    };

    const drawTableHeader = (startY: number) => {
      doc
        .rect(leftX, startY, pageWidth, 24)
        .fillColor('#F1F5F9')
        .fill()
        .strokeColor('#CBD5E1')
        .lineWidth(0.6)
        .stroke();

      doc.fillColor('#334155').font('Helvetica-Bold').fontSize(8.5);
      doc.text('Matière & Enseignant', leftX + 8, startY + 7, { width: colWidths.subject - 12 });
      doc.text('Coeff.', leftX + colWidths.subject, startY + 7, {
        width: colWidths.coeff,
        align: 'center',
      });
      doc.text('Moy. Élève', leftX + colWidths.subject + colWidths.coeff, startY + 7, {
        width: colWidths.studentAvg,
        align: 'right',
      });
      doc.text(
        'Moy. Classe',
        leftX + colWidths.subject + colWidths.coeff + colWidths.studentAvg,
        startY + 7,
        { width: colWidths.classAvg, align: 'right' }
      );
      doc.text(
        'Appréciation du professeur',
        leftX + colWidths.subject + colWidths.coeff + colWidths.studentAvg + colWidths.classAvg + 10,
        startY + 7,
        { width: colWidths.remark - 14 }
      );
      return startY + 24;
    };

    y = drawTableHeader(y);

    for (let i = 0; i < detail.subjects.length; i += 1) {
      const sub = detail.subjects[i];
      const remarkText = sub.teacherRemark || '—';
      const rowHeight = Math.max(
        30,
        doc.heightOfString(remarkText, { width: colWidths.remark - 14, align: 'left' }) + 12
      );

      if (y + rowHeight > doc.page.height - 150) {
        doc.addPage();
        y = 40;
        y = drawTableHeader(y);
      }

      if (i % 2 === 1) {
        doc.rect(leftX, y, pageWidth, rowHeight).fillColor('#F8FAFC').fill();
      }

      doc
        .rect(leftX, y, pageWidth, rowHeight)
        .strokeColor('#E2E8F0')
        .lineWidth(0.5)
        .stroke();

      doc
        .fillColor('#0F172A')
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .text(`${sub.subjectName}`, leftX + 8, y + 6, { width: colWidths.subject - 12 });

      if (sub.teacherFullName) {
        doc
          .fillColor('#64748B')
          .font('Helvetica')
          .fontSize(7.5)
          .text(sub.teacherFullName, leftX + 8, y + 17, { width: colWidths.subject - 12 });
      }

      doc
        .fillColor('#334155')
        .font('Helvetica')
        .fontSize(8.5)
        .text(String(sub.coefficient), leftX + colWidths.subject, y + 10, {
          width: colWidths.coeff,
          align: 'center',
        });

      doc
        .fillColor(
          sub.subjectAverage !== null && sub.subjectAverage < 10 ? '#B91C1C' : '#0F172A'
        )
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(
          sub.subjectAverage !== null ? `${sub.subjectAverage.toFixed(2)}` : '—',
          leftX + colWidths.subject + colWidths.coeff,
          y + 10,
          { width: colWidths.studentAvg, align: 'right' }
        );

      doc
        .fillColor('#64748B')
        .font('Helvetica')
        .fontSize(8.5)
        .text(
          sub.classSubjectAverage !== null ? `${sub.classSubjectAverage.toFixed(2)}` : '—',
          leftX + colWidths.subject + colWidths.coeff + colWidths.studentAvg,
          y + 10,
          { width: colWidths.classAvg, align: 'right' }
        );

      doc
        .fillColor('#334155')
        .font('Helvetica')
        .fontSize(8)
        .text(
          remarkText,
          leftX + colWidths.subject + colWidths.coeff + colWidths.studentAvg + colWidths.classAvg + 10,
          y + 8,
          { width: colWidths.remark - 14 }
        );

      y += rowHeight;
    }

    // 4. Bloc synthèse & décision du conseil de classe
    y += 16;
    if (y + 135 > doc.page.height - 40) {
      doc.addPage();
      y = 40;
    }

    doc
      .rect(leftX, y, pageWidth, 56)
      .fillColor('#F8FAFC')
      .fill()
      .strokeColor('#94A3B8')
      .lineWidth(0.8)
      .stroke();

    const thirdW = pageWidth / 3;
    doc.fillColor('#64748B').font('Helvetica').fontSize(8);
    doc.text('MOYENNE GÉNÉRALE', leftX + 12, y + 10);
    doc.text('MOYENNE DE CLASSE', leftX + thirdW + 12, y + 10);
    doc.text('RANG & DISTINCTION', leftX + thirdW * 2 + 12, y + 10);

    doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(13);
    doc.text(
      detail.generalAverage !== null ? `${detail.generalAverage.toFixed(2)} / 20` : '—',
      leftX + 12,
      y + 24
    );
    doc.text(
      detail.classAverage !== null ? `${detail.classAverage.toFixed(2)} / 20` : '—',
      leftX + thirdW + 12,
      y + 24
    );
    doc.fontSize(11).text(
      `${detail.rank !== null ? `${detail.rank}e / ${detail.totalStudents}` : '—'}${
        detail.honorMention ? ` · ${detail.honorMention}` : ''
      }`,
      leftX + thirdW * 2 + 12,
      y + 25,
      { width: thirdW - 20 }
    );

    y += 70;
    doc
      .rect(leftX, y, pageWidth, 54)
      .strokeColor('#CBD5E1')
      .lineWidth(0.6)
      .stroke();

    doc
      .fillColor('#64748B')
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('APPRÉCIATION DU CONSEIL DE CLASSE', leftX + 12, y + 8);

    doc
      .fillColor('#1E293B')
      .font('Helvetica')
      .fontSize(9)
      .text(
        detail.councilRemark || 'Aucune appréciation générale enregistrée.',
        leftX + 12,
        y + 22,
        { width: pageWidth - 24 }
      );

    y += 72;
    const statusLabel =
      detail.status === 'VALIDATED' && detail.validatedAt
        ? `Document validé le ${detail.validatedAt.slice(0, 10)}`
        : 'Document provisoire (brouillon non validé)';

    doc
      .fillColor('#64748B')
      .font('Helvetica-Oblique')
      .fontSize(8)
      .text(statusLabel, leftX, y);

    doc
      .fillColor('#0F172A')
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .text('Le Chef d’établissement', leftX + 340, y, {
        width: pageWidth - 340,
        align: 'right',
      });

    doc.end();
  });
}
