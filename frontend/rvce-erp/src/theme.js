import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    primary: {
      main: "#8B0000", // RVCE deep red
    },
    secondary: {
      main: "#2F4F4F",
    }
  },
  typography: {
    fontFamily: "Inter, Roboto, sans-serif",
  }
});

export default theme;