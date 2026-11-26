import { Router } from 'express';
import ExcelJS from 'exceljs';
import { loadSessionData } from '../lib/bundle.js';

export const adminExportRouter = Router();

adminExportRouter.get('/sessions/:sessionId/export.xlsx', async (req, res) => {
  const data = await loadSessionData(req.params.sessionId);
  if (!data) {
    res.status(404).json({ error: '교육 회차를 찾을 수 없습니다.' });
    return;
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'training-server';
  wb.created = new Date();

  const summary = wb.addWorksheet('요약');
  summary.columns = [
    { header: '단계', key: 'stage', width: 26 },
    { header: '미션', key: 'mission', width: 34 },
    { header: '제출 조', key: 'submitted', width: 10 },
    { header: '전체 조', key: 'total', width: 10 }
  ];
  summary.getRow(1).font = { bold: true };

  for (const stage of data.stages) {
    const missionRows = data.missions.filter((m) => m.stageId === stage.id);
    if (!missionRows.length) {
      summary.addRow({
        stage: `${stage.seq}. ${stage.title}`,
        mission: '(미션 없음)',
        submitted: 0,
        total: data.teams.length
      });
      continue;
    }
    for (const mission of missionRows) {
      const submitted = data.submissions.filter(
        (s) => s.missionId === mission.id && s.status === 'submitted'
      ).length;
      summary.addRow({
        stage: `${stage.seq}. ${stage.title}`,
        mission: `${mission.seq}. ${mission.title || mission.prompt.slice(0, 30)}`,
        submitted,
        total: data.teams.length
      });
    }
  }

  for (const stage of data.stages) {
    const ws = wb.addWorksheet(`S${stage.seq}`);
    ws.columns = [
      { header: '조', key: 'team', width: 16 },
      { header: '미션', key: 'mission', width: 30 },
      { header: '답변', key: 'content', width: 60 },
      { header: '첨부', key: 'file', width: 36 },
      { header: '상태', key: 'status', width: 10 },
      { header: '제출 시각', key: 'submittedAt', width: 22 },
      { header: '점수', key: 'score', width: 8 },
      { header: '피드백', key: 'feedback', width: 46 }
    ];
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    const missionRows = data.missions
      .filter((m) => m.stageId === stage.id)
      .sort((a, b) => a.seq - b.seq);

    for (const mission of missionRows) {
      for (const team of data.teams) {
        const submission = data.submissions.find(
          (s) => s.missionId === mission.id && s.teamId === team.id
        );
        const teamFeedbacks = submission
          ? data.feedbacks.filter((f) => f.submissionId === submission.id)
          : [];
        ws.addRow({
          team: team.name,
          mission: `${mission.seq}. ${mission.title || mission.prompt.slice(0, 24)}`,
          content: submission?.content ?? '',
          file: submission?.fileUrl ?? '',
          status:
            submission?.status === 'submitted'
              ? '제출'
              : submission?.status === 'draft'
                ? '작성중'
                : '미제출',
          submittedAt: submission?.submittedAt
            ? new Date(submission.submittedAt).toLocaleString('ko-KR')
            : '',
          score: teamFeedbacks.find((f) => f.score !== null)?.score ?? '',
          feedback: teamFeedbacks.map((f) => f.body).filter(Boolean).join(' / ')
        });
      }
    }

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      row.alignment = { vertical: 'top', wrapText: true };
    });
  }

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="training-${data.session.joinCode}.xlsx"`
  );

  await wb.xlsx.write(res);
  res.end();
});
