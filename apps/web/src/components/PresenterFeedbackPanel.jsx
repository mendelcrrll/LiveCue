import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

function PresenterFeedbackPanel({ liveFeedbackEvents = [], slide }) {
  const priorityItems = [...(slide.buildData?.priorityItems ?? [])].sort(
    (a, b) => a.priority - b.priority
  );
  const accessibilityChecks = slide.buildData?.accessibilityChecks ?? [];

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateRows: { xs: 'auto auto', lg: 'minmax(0, 1fr) minmax(0, 1fr)' },
        gap: 2,
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <PresenterWindow title="Priority Queue">
        <Stack spacing={1}>
          {priorityItems.length > 0 ? (
            priorityItems.map((item, index) => {
              const isComplete = isPriorityItemComplete(item);

              return (
                <Box
                  key={item.id ?? `${item.text}-${index}`}
                  data-priority-item-id={item.id}
                  data-priority-complete={isComplete ? 'true' : 'false'}
                  sx={{
                    minHeight: 42,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: 1.5,
                    py: 1,
                    borderRadius: 1,
                    border: '1px solid var(--border, #e5e4e7)',
                    backgroundColor:
                      index === 0
                        ? 'var(--interactive-bg, #e8def8)'
                        : 'var(--surface, #f7f4fb)',
                    opacity: isComplete ? 0.58 : 1,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{ color: 'var(--text-muted)', fontWeight: 800, width: 28 }}
                  >
                    #{index + 1}
                  </Typography>
                  <Typography
                    sx={{
                      color: 'var(--text-h)',
                      fontWeight: index === 0 ? 700 : 500,
                      textDecoration: isComplete ? 'line-through' : 'none',
                      textDecorationThickness: 2,
                    }}
                  >
                    {item.text || 'Untitled priority'}
                  </Typography>
                </Box>
              );
            })
          ) : (
            <Typography sx={{ color: 'var(--text-muted)' }}>
              No priority feedback has been configured for this slide.
            </Typography>
          )}
        </Stack>
      </PresenterWindow>

      <PresenterWindow title="Live Feedback Log">
        <Stack spacing={1.25}>
          {liveFeedbackEvents.length > 0 ? (
            liveFeedbackEvents.map((event, index) => (
              <Box
                key={`${event.createdAt ?? 'event'}-${index}`}
                sx={{
                  border: '1px solid var(--border, #e5e4e7)',
                  borderRadius: 1,
                  px: 1.5,
                  py: 1,
                  backgroundColor: 'var(--surface, #f7f4fb)',
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}
                >
                  {formatEventKind(event.kind)}
                </Typography>
                <Typography sx={{ color: 'var(--text-h)' }}>
                  {event.message || event.action || 'Feedback updated'}
                </Typography>
              </Box>
            ))
          ) : (
            <Typography sx={{ color: 'var(--text-muted)' }}>
              Feedback decisions will appear as transcript chunks are processed.
            </Typography>
          )}

          {accessibilityChecks.length > 0 && (
            <Box sx={{ pt: 0.5 }}>
              <Typography variant="subtitle2" sx={{ color: 'var(--text-h)', fontWeight: 800 }}>
                Accessibility
              </Typography>
              <Stack spacing={0.75} sx={{ mt: 0.75 }}>
                {accessibilityChecks.map((check) => (
                  <Box
                    key={check.id}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 1,
                      color: 'var(--text-muted)',
                    }}
                  >
                    <Typography variant="body2">{check.label}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 750 }}>
                      {formatStatus(check.status)}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      </PresenterWindow>
    </Box>
  );
}

function PresenterWindow({ title, children }) {
  return (
    <Paper
      elevation={0}
      sx={{
        border: '1px solid var(--border, #e5e4e7)',
        backgroundColor: 'var(--surface-raised, #ffffff)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <Stack spacing={0} sx={{ height: '100%' }}>
        <Box
          sx={{
            px: 2,
            py: 0.75,
            borderBottom: '1px solid var(--border, #e5e4e7)',
            backgroundColor: 'var(--surface, #f7f4fb)',
          }}
        >
          <Typography variant="subtitle1" sx={{ color: 'var(--text-h)', fontWeight: 750 }}>
            {title}
          </Typography>
        </Box>
        <Box sx={{ p: 1.5, minHeight: 0, flex: 1, overflowY: 'auto' }}>{children}</Box>
      </Stack>
    </Paper>
  );
}

function isPriorityItemComplete(item) {
  return Boolean(item.completed || item.complete || item.isComplete || item.finished);
}

function formatEventKind(kind = '') {
  if (!kind) {
    return 'Update';
  }

  return kind.replace(/[_-]/g, ' ');
}

function formatStatus(status = 'pending') {
  return status.replace(/[_-]/g, ' ');
}

export default PresenterFeedbackPanel;
