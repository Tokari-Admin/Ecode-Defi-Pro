import {extendTheme} from '@mui/joy/styles';

declare module '@mui/joy/styles' {
  interface Palette {
    success: {
      solidBg: string;
      solidColor: string;
    };
  }
}

export const theme = extendTheme({
  colorSchemes: {
    light: {
      palette: {
        success: {
          solidBg: '#237d4d',
          solidColor: '#ffffff',
        },
      },
    },
  },
  fontFamily: {
    body: 'PT Sans, sans-serif',
    display: 'PT Sans, sans-serif',
  },
});
