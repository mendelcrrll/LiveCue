import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import FeedbackCardShell from './FeedbackCardShell';

function VignetteFeedbackCard({
  title,
  theme,
  score = 0,
  vignetteCount = 0,
  hasFeedback = false,
  isGenerating = false,
  expanded,
  ...cardProps
}) {
  const displayScore = hasFeedback ? score : 0;
  const displayScoreText = hasFeedback ? String(displayScore) : '--';
  const modeLabel = isGenerating
    ? 'Generating'
    : hasFeedback
      ? `${vignetteCount} audience view${vignetteCount === 1 ? '' : 's'}`
      : 'Awaiting saved feedback';
  const criteria = Array.isArray(theme?.criteria) ? theme.criteria : [];

  return (
    <FeedbackCardShell title={title} expanded={expanded} {...cardProps}>
      <Stack
        spacing={expanded ? 2 : 1.2}
        sx={{
          height: '100%',
          minHeight: 0,
          p: expanded ? 2.5 : 1.5,
          textAlign: 'left',
        }}
      >
        <Stack spacing={0.75}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.5}>
            <Typography variant="caption" sx={{ color: 'var(--text-muted)', fontWeight: 800 }}>
              {modeLabel}
            </Typography>
            {isGenerating && <CircularProgress size={16} color="inherit" />}
          </Stack>

          <Stack direction="row" alignItems="baseline" spacing={0.75}>
            <Typography
              variant={expanded ? 'h4' : 'h3'}
              sx={{ color: 'var(--text-h)', fontWeight: 900, lineHeight: 1 }}
            >
              {displayScoreText}
            </Typography>
            <Typography variant="subtitle2" sx={{ color: 'var(--text-muted)', fontWeight: 800 }}>
              /100
            </Typography>
          </Stack>
        </Stack>

        <LinearProgress
          variant={isGenerating ? 'indeterminate' : 'determinate'}
          value={displayScore}
          sx={{
            height: 8,
            borderRadius: 1,
            backgroundColor: 'var(--surface)',
            '& .MuiLinearProgress-bar': {
              borderRadius: 1,
              backgroundColor: getScoreColor(displayScore),
            },
          }}
        />

          <Typography
            variant="body2"
          sx={{
            color: 'var(--text)',
            display: expanded ? 'block' : '-webkit-box',
            WebkitLineClamp: expanded ? 'unset' : 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {isGenerating
            ? 'The model is reading the saved vignettes and presentation transcript.'
            : hasFeedback
              ? theme.summary
              : 'Save an audience vignette and generate feedback to populate this card from the database.'}
        </Typography>

        {expanded && hasFeedback && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
              gap: 1.25,
            }}
          >
            {criteria.map((criterion) => (
              <CriterionScore key={criterion.label} criterion={criterion} />
            ))}
          </Box>
        )}
      </Stack>
    </FeedbackCardShell>
  );
}

function CriterionScore({ criterion }) {
  return (
    <Stack
      spacing={1}
      sx={{
        p: 1.25,
        border: '1px solid var(--border)',
        borderRadius: 2,
        backgroundColor: 'var(--surface)',
        minWidth: 0,
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
        <Typography variant="subtitle2" sx={{ color: 'var(--text-h)', fontWeight: 800 }}>
          {criterion.label}
        </Typography>
        <Typography variant="subtitle2" sx={{ color: 'var(--text-h)', fontWeight: 900 }}>
          {criterion.score}
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={criterion.score}
        sx={{
          height: 6,
          borderRadius: 1,
          backgroundColor: 'var(--surface-raised)',
          '& .MuiLinearProgress-bar': {
            borderRadius: 1,
            backgroundColor: getScoreColor(criterion.score),
          },
        }}
      />
      <Typography variant="body2" sx={{ color: 'var(--text)' }}>
        {criterion.feedback}
      </Typography>
    </Stack>
  );
}

function getScoreColor(score) {
  if (score >= 82) {
    return '#4f8f3a';
  }
  if (score >= 68) {
    return '#b28b21';
  }
  return '#b94e4e';
}

export default VignetteFeedbackCard;
