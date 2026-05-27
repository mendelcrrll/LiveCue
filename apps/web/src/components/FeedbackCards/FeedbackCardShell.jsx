import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import DragIndicatorOutlinedIcon from '@mui/icons-material/DragIndicatorOutlined';
import KeyboardArrowDownOutlinedIcon from '@mui/icons-material/KeyboardArrowDownOutlined';
import KeyboardArrowUpOutlinedIcon from '@mui/icons-material/KeyboardArrowUpOutlined';

function FeedbackCardShell({
  id,
  title,
  expanded,
  onToggleExpand,
  onDragStart,
  onDragOver,
  onDrop,
  children,
}) {
  return (
    <Paper
      elevation={0}
      draggable
      onDragStart={(event) => onDragStart(event, id)}
      onDragOver={(event) => onDragOver(event, id)}
      onDrop={(event) => onDrop(event, id)}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: expanded ? 'auto' : '100%',
        minHeight: expanded ? 520 : 320,
        gridColumn: expanded ? '1 / -1' : 'auto',
        border: '1px solid var(--border)',
        borderRadius: 2,
        backgroundColor: 'var(--surface-raised)',
        color: 'var(--text)',
        overflow: expanded ? 'visible' : 'hidden',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={1}
        sx={{
          px: 1.5,
          py: 0.75,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={0.5} minWidth={0}>
          <Tooltip title="Move card">
            <DragIndicatorOutlinedIcon
              fontSize="small"
              sx={{ color: 'var(--text-muted)', cursor: 'grab', flexShrink: 0 }}
            />
          </Tooltip>
          <Typography
            variant="subtitle2"
            noWrap
            sx={{ color: 'var(--text-h)', fontWeight: 700 }}
          >
            {title}
          </Typography>
        </Stack>

        <Box sx={{ width: 30, flexShrink: 0 }} />
      </Stack>

      <Box sx={{ flex: 1, minHeight: 0 }}>{children}</Box>

      <Tooltip title={expanded ? 'Collapse' : 'Expand'}>
        <IconButton
          size="small"
          aria-label={expanded ? 'collapse card' : 'expand card'}
          onClick={onToggleExpand}
          sx={{
            width: '100%',
            height: 28,
            borderRadius: 0,
            color: 'var(--text-muted)',
            '&:hover': {
              backgroundColor: 'var(--interactive-bg-hover)',
            },
          }}
        >
          <Stack alignItems="center" spacing={0} sx={{ lineHeight: 1 }}>
            <Stack spacing={0.25} sx={{ width: 20, alignItems: 'center' }}>
              <Box sx={{ width: 16, height: 1, backgroundColor: 'currentColor' }} />
              <Box sx={{ width: 12, height: 1, backgroundColor: 'currentColor' }} />
              <Box sx={{ width: 8, height: 1, backgroundColor: 'currentColor' }} />
            </Stack>
            {expanded ? (
              <KeyboardArrowUpOutlinedIcon fontSize="small" />
            ) : (
              <KeyboardArrowDownOutlinedIcon fontSize="small" />
            )}
          </Stack>
        </IconButton>
      </Tooltip>
    </Paper>
  );
}

export default FeedbackCardShell;
