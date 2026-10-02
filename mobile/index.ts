// A ordem importa: os adaptadores do navegador precisam existir antes de qualquer módulo
// da lógica compartilhada ser carregado.
import "./src/platform/polyfills";
import "expo-router/entry";
