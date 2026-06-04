import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { isPriorityItemComplete } from '../utils/slideUtils';

function PresenterFeedbackPanel({ slide }) {
  const priorityItems = [...(slide.buildData?.priorityItems ?? [])].sort(
    (a, b) => a.priority - b.priority
  );
  const completedGoalCount = priorityItems.filter(isPriorityItemComplete).length;
  const goalProgress = priorityItems.length
    ? Math.round((completedGoalCount / priorityItems.length) * 100)
    : 0;

  return (
    <PresenterWindow title="Current Goals">
      <Stack spacing={1.5} sx={{ minHeight: 0 }}>
        <Box>
          <Stack direction="row" alignItems="baseline" justifyContent="space-between" gap={2}>
            <Typography variant="body2" sx={{ color: 'var(--text-h)', fontWeight: 800 }}>
              Progress
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: 'var(--text-muted)', fontWeight: 800, flexShrink: 0 }}
            >
              {completedGoalCount}/{priorityItems.length} complete
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={goalProgress}
            aria-label="Current goals progress"
            sx={{
              mt: 0.75,
              height: 10,
              borderRadius: 999,
              backgroundColor: 'var(--surface, #f7f4fb)',
              '& .MuiLinearProgress-bar': {
                borderRadius: 999,
                backgroundColor: 'var(--interactive-border, #8e72bf)',
              },
            }}
          />
        </Box>

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
                    minHeight: 52,
                    display: 'grid',
                    gridTemplateColumns: '32px minmax(0, 1fr)',
                    gap: 1.5,
                    px: 1.5,
                    py: 1.25,
                    borderRadius: 1,
                    border: '1px solid var(--border, #e5e4e7)',
                    backgroundColor:
                      !isComplete && index === completedGoalCount
                        ? 'var(--interactive-bg, #e8def8)'
                        : 'var(--surface, #f7f4fb)',
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{ color: 'var(--text-muted)', fontWeight: 800, pt: 0.25 }}
                  >
                    #{index + 1}
                  </Typography>
                  <Box sx={{ minWidth: 0 }}>
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="baseline"
                      justifyContent="space-between"
                    >
                      <Typography
                        sx={{
                          color: 'var(--text-h)',
                          fontWeight: !isComplete && index === completedGoalCount ? 700 : 500,
                        }}
                      >
                        {item.text || 'Untitled goal'}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: isComplete
                            ? 'var(--interactive-border, #8e72bf)'
                            : 'var(--text-muted)',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          flexShrink: 0,
                        }}
                      >
                        {isComplete ? 'Done' : 'Pending'}
                      </Typography>
                    </Stack>
                  </Box>
                </Box>
              );
            })
          ) : (
            <Typography sx={{ color: 'var(--text-muted)' }}>
              No goals have been configured for this slide.
            </Typography>
          )}
        </Stack>
      </Stack>
    </PresenterWindow>
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

export default PresenterFeedbackPanel;
