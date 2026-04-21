import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import CreateNewFolderOutlinedIcon from '@mui/icons-material/CreateNewFolderOutlined';
import NoteAddOutlinedIcon from '@mui/icons-material/NoteAddOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';

const ACTIONS = [
  {
    key: 'folder',
    label: 'Add Folder',
    icon: <CreateNewFolderOutlinedIcon fontSize="small" />,
  },
  {
    key: 'file',
    label: 'Add File',
    icon: <NoteAddOutlinedIcon fontSize="small" />,
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
  onAddFile,
  onRequestSlides,
  onRemove,
}) {
  const handlers = {
    folder: onAddFolder,
    file: onAddFile,
    slides: onRequestSlides,
  };

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
      {ACTIONS.map((action) => (
        <Button
          key={action.key}
          variant="outlined"
          startIcon={action.icon}
          onClick={handlers[action.key]}
          disabled={!canCreate}
          sx={{
            borderColor: 'var(--interactive-border, #8e72bf)',
            color: 'var(--text-h, #08060d)',
            backgroundColor: 'var(--surface, #f7f4fb)',
            '&.Mui-disabled': {
              borderColor: 'var(--border, #3b3743)',
              color: 'var(--text-muted, #8d8599)',
              backgroundColor: 'var(--surface, #19161f)',
            },
          }}
        >
          {action.label}
        </Button>
      ))}
      <Button
        variant="text"
        color="error"
        startIcon={<DeleteOutlineOutlinedIcon fontSize="small" />}
        onClick={onRemove}
        disabled={!canRemove}
        sx={{
          color: 'var(--danger, #ff7b72)',
          '&.Mui-disabled': {
            color: 'var(--text-muted, #8d8599)',
          },
        }}
      >
        Remove Selected
      </Button>
    </Stack>
  );
}
