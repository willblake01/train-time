import { createTheme } from '@mui/material/styles';

const amber = '#ffb000';
const amtrakBlue = '#00537E';

export const RAIL_FONT = '"Train One", system-ui, sans-serif';

// Light: white cards, black text. Dark: departure-board black with amber text.
// cssVariables + colorSchemes makes MUI emit both palettes as CSS variables and
// switch between them with the OS-level prefers-color-scheme setting, so the
// right mode is applied before any JavaScript runs (no flash on load).
export const theme = createTheme({
    cssVariables: true,
    typography: {
        // CardHeader titles render as h5 by default, so this styles every card title
        h5: { fontFamily: RAIL_FONT, fontWeight: 400 },
    },
    colorSchemes: {
        light: {
            palette: {
                primary: { main: amtrakBlue },
                background: { default: '#f4f5f7', paper: '#ffffff' },
                text: { primary: '#111111', secondary: '#5f6368' },
            },
        },
        dark: {
            palette: {
                primary: { main: amber },
                background: { default: '#0b0c0e', paper: '#101214' },
                text: { primary: '#ffffff', secondary: '#9aa0a6' },
                divider: '#2a2e33',
                success: { main: '#4cd964' },
                warning: { main: amber },
                error: { main: '#ff5a4f' },
            },
        },
    },
    components: {
        // MUI lightens raised surfaces in dark mode with a gradient overlay; turn it
        // off so cards match the departure board's flat black
        MuiPaper: {
            styleOverrides: {
                root: { backgroundImage: 'none' },
            },
        },
    },
});