import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

function CollapsiblePanelRail({ label, onExpand, topOffset = 88 }) {
  const railHeight = `calc(100vh - ${topOffset + 24}px)`;

  return (
    <Paper
      elevation={0}
      sx={{
        display: { xs: 'none', md: 'flex' },
        position: { md: 'sticky' },
        top: { md: topOffset },
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
        alignSelf: 'stretch',
        minHeight: 240,
        height: { md: railHeight },
        maxHeight: { md: railHeight },
        px: 0.5,
        py: 1,
        border: '1px solid var(--border)',
        backgroundColor: 'var(--surface-raised)',
        color: 'var(--text)',
      }}
    >
      <Tooltip title={`Show ${label}`} placement="right" arrow>
        <IconButton
          aria-label={`show ${label}`}
          onClick={onExpand}
          sx={{
            color: 'var(--interactive-text)',
            backgroundColor: 'var(--interactive-bg)',
            border: '1px solid var(--interactive-border)',
            '&:hover': {
              backgroundColor: 'var(--interactive-bg-hover)',
            },
          }}
        >
          <ChevronRightOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Box sx={{ flex: 1, display: 'grid', placeItems: 'center' }}>
        <Typography
          variant="caption"
          sx={{
            color: 'var(--text-muted)',
            fontWeight: 800,
            letterSpacing: 0,
            textTransform: 'none',
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </Typography>
      </Box>
    </Paper>
  );
}

export default CollapsiblePanelRail;
