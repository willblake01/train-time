import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';
import { ContentCopy as CopyIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { linkDevice, unlinkDevice, useDevices } from '../utils';

interface LinkDeviceDialogProps {
  open: boolean;
  onClose: () => void;
}

// Link a device (like an LED strip) that shows your next train and warns when
// a connection is at risk. The token is shown once; only its hash is stored.
const LinkDeviceDialog = ({ open, onClose }: LinkDeviceDialogProps) => {
  const devices = useDevices();
  const [label, setLabel] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const close = () => {
    setToken(null);
    setLabel('');
    setError(null);
    setCopied(false);
    onClose();
  };

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const device = await linkDevice(label);
      setToken(device.token);
      setLabel('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setError(null);
    try {
      await unlinkDevice(id);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const copy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
    } catch {
      setError('Copy failed. Select the token and copy it manually.');
    }
  };

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm" aria-labelledby="link-device-title">
      <DialogTitle id="link-device-title">Linked devices</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          A linked device can read your next train and connection status, but can&apos;t see or change anything else.
          Links belong to this browser&apos;s trips.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {token ? (
          <Box sx={{ mb: 2 }}>
            <Alert severity="success" sx={{ mb: 1 }}>
              Copy this token now. It won&apos;t be shown again.
            </Alert>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField
                value={token}
                fullWidth
                size="small"
                slotProps={{ htmlInput: { readOnly: true, 'aria-label': 'Device token', style: { fontFamily: 'monospace' } } }}
                onFocus={(e) => e.target.select()}
              />
              <IconButton onClick={copy} aria-label="Copy token">
                <CopyIcon fontSize="small" />
              </IconButton>
            </Box>
            <Typography variant="body2" sx={{ color: copied ? 'success.main' : 'text.secondary', mt: 1 }}>
              {copied ? 'Copied. ' : ''}On the device, set it as <code>TRAIN_TIME_TOKEN</code>.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              label="Device name"
              placeholder="LED strip"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              size="small"
              fullWidth
              slotProps={{ htmlInput: { maxLength: 40 } }}
            />
            <Button variant="contained" onClick={create} disabled={busy}>
              {busy ? 'Linking…' : 'Link'}
            </Button>
          </Box>
        )}

        {devices.length > 0 && (
          <List dense aria-label="Linked devices">
            {devices.map((device) => (
              <ListItem
                key={device.id}
                secondaryAction={
                  <IconButton edge="end" onClick={() => remove(device.id)} aria-label={`Unlink ${device.label}`}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                }
              >
                <ListItemText
                  primary={device.label}
                  secondary={device.createdAt ? `Linked ${new Date(device.createdAt).toLocaleDateString()}` : undefined}
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>Done</Button>
      </DialogActions>
    </Dialog>
  );
};

export default LinkDeviceDialog;
