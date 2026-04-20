import { useState } from 'react';
import { alpha, styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import InputBase from '@mui/material/InputBase';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import SearchIcon from '@mui/icons-material/Search';

const Search = styled('div')(({ theme }) => ({
  position: 'relative',
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.common.white, 0.18),
  '&:hover': {
    backgroundColor: alpha(theme.palette.common.white, 0.26),
  },
  border: `1px solid ${alpha(theme.palette.common.white, 0.35)}`,
  marginLeft: theme.spacing(3),
  width: '100%',
  maxWidth: 360,
  [theme.breakpoints.down('sm')]: {
    marginLeft: theme.spacing(1),
  },
}));

const SearchIconWrapper = styled('div')(({ theme }) => ({
  padding: theme.spacing(0, 2),
  height: '100%',
  position: 'absolute',
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: 'inherit',
  width: '100%',
  '& .MuiInputBase-input': {
    padding: theme.spacing(1.25, 1.5, 1.25, 0),
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    '&::placeholder': {
      color: alpha(theme.palette.common.white, 0.92),
      opacity: 1,
    },
  },
}));

function flattenTree(nodes, path = []) {
  return nodes.flatMap((node) => {
    const nextPath = [...path, node.name];
    const currentNode = {
      id: node.id,
      name: node.name,
      type: node.type,
      pathLabel: nextPath.join(' / '),
    };

    if (!node.children) {
      return [currentNode];
    }

    return [currentNode, ...flattenTree(node.children, nextPath)];
  });
}

export default function SearchBar({ treeData, onSelectNode }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const searchableItems = flattenTree(treeData);
  const normalizedTerm = searchTerm.trim().toLowerCase();
  const results = normalizedTerm
    ? searchableItems
        .filter(
          (item) =>
            item.name.toLowerCase().includes(normalizedTerm) ||
            item.pathLabel.toLowerCase().includes(normalizedTerm)
        )
        .slice(0, 6)
    : [];

  const handleSelect = (itemId) => {
    onSelectNode(itemId);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <Search>
      <SearchIconWrapper>
        <SearchIcon />
      </SearchIconWrapper>
      <StyledInputBase
        placeholder="Search presentations..."
        inputProps={{ 'aria-label': 'search presentations' }}
        value={searchTerm}
        onChange={(event) => {
          setSearchTerm(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setIsOpen(false), 120);
        }}
      />

      {isOpen && normalizedTerm && (
        <Paper
          elevation={6}
          sx={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            right: 0,
            zIndex: 2,
            overflow: 'hidden',
            borderRadius: 2,
            border: '1px solid var(--border, #e5e4e7)',
            backgroundColor: 'var(--surface-raised, #ffffff)',
            color: 'var(--text-h, #08060d)',
          }}
        >
          {results.length > 0 ? (
            <List disablePadding>
              {results.map((item) => (
                <ListItemButton
                  key={item.id}
                  onMouseDown={() => handleSelect(item.id)}
                  sx={{
                    alignItems: 'flex-start',
                    py: 1.25,
                    px: 1.5,
                  }}
                >
                  <ListItemText
                    primary={item.name}
                    primaryTypographyProps={{
                      color: 'var(--text-h, #08060d)',
                      fontWeight: 600,
                    }}
                    secondary={
                      <Box component="span">
                        <Typography
                          component="span"
                          variant="caption"
                          sx={{
                            display: 'block',
                            color: 'var(--text-muted, #6b6577)',
                            textTransform: 'capitalize',
                          }}
                        >
                          {item.type}
                        </Typography>
                        <Typography
                          component="span"
                          variant="caption"
                          sx={{
                            display: 'block',
                            color: 'var(--text, #4e4858)',
                          }}
                        >
                          {item.pathLabel}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItemButton>
              ))}
            </List>
          ) : (
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="body2" sx={{ color: 'var(--text, #4e4858)' }}>
                No matching presentations or files.
              </Typography>
            </Box>
          )}
        </Paper>
      )}
    </Search>
  );
}
