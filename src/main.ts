import "./styles.css";
import { mountApp } from "./ui/app";

const root = document.querySelector<HTMLElement>("#app");
if (root === null) throw new Error("Application root was not found.");
mountApp(root);
