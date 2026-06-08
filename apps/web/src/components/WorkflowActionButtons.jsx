import CreateNewFolderOutlinedIcon from '@mui/icons-material/CreateNewFolderOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';

const ACTIONS = [
  {
    key: 'folder',
    label: 'Add Folder',
    icon: <CreateNewFolderOutlinedIcon fontSize="small" />,
  },
  {
    key: 'slides',
    label: 'Request Slides',
    icon: <LinkOutlinedIcon fontSize="small" />,
  },
];

export default function WorkflowActionButtons({
  canCreate = true,
  canRemove = false,
  onAddFolder,
  onRequestSlides,
  onRemove,
}) {
  const handlers = {
    folder: onAddFolder,
    slides: onRequestSlides,
  };

  return (
    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
      {ACTIONS.map((action) => (
        <Tooltip key={action.key} title={action.label}>
          <span>
            <IconButton
              aria-label={action.label}
              onClick={handlers[action.key]}
              disabled={!canCreate}
              sx={{
                border: '1px solid var(--interactive-border, #8e72bf)',
                color: 'var(--text-h, #08060d)',
                backgroundColor: 'var(--surface, #f7f4fb)',
                '&:hover': {
                  backgroundColor: 'var(--interactive-bg-hover, #ddd0f5)',
                },
                '&.Mui-disabled': {
                  borderColor: 'var(--border, #3b3743)',
                  color: 'var(--text-muted, #8d8599)',
                  backgroundColor: 'var(--surface, #19161f)',
                },
              }}
            >
              {action.icon}
            </IconButton>
          </span>
        </Tooltip>
      ))}
      <Tooltip title="Remove Selected">
        <span>
          <IconButton
            aria-label="Remove Selected"
            onClick={onRemove}
            disabled={!canRemove}
            sx={{
              border: '1px solid transparent',
              color: 'var(--danger, #ff7b72)',
              '&:hover': {
                backgroundColor: 'rgba(255, 123, 114, 0.12)',
              },
              '&.Mui-disabled': {
                color: 'var(--text-muted, #8d8599)',
              },
            }}
          >
            <DeleteOutlineOutlinedIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  );
}
