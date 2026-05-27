import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import FeedbackCardShell from './FeedbackCardShell';

function PlaceholderFeedbackCard({ title, value, expanded, ...cardProps }) {
  return (
    <FeedbackCardShell title={title} expanded={expanded} {...cardProps}>
      <Stack
        alignItems="center"
        justifyContent="center"
        spacing={expanded ? 2 : 1}
        sx={{ height: '100%', p: 2 }}
      >
        <Typography
          variant={expanded ? 'h1' : 'h2'}
          sx={{ color: 'var(--text-h)', fontWeight: 800, lineHeight: 1 }}
        >
          {value}
        </Typography>
        {expanded && (
          <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
            Expanded view
          </Typography>
        )}
      </Stack>
    </FeedbackCardShell>
  );
}

export default PlaceholderFeedbackCard;
