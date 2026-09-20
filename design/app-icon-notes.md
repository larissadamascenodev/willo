# Ícone do app

Gerado a partir do próprio "w" do wordmark (`src/assets/logo/willo-wordmark-dark.png`),
recortado e recolorido — a letra do ícone é exatamente a da marca.

## Arquivos

| Arquivo | Uso |
| --- | --- |
| `app-icon-1024.png` | Ícone padrão: "w" branco sobre preto `#0B0B0B` |
| `app-icon-1024-dark.png` | Variante escura do iOS 18 (igual à padrão) |
| `app-icon-1024-tinted.png` | Variante tingida do iOS 18 (tons de cinza) |
| `app-icon-1024-alt-verde.png` | Alternativa: "w" preto sobre verde `#C8F36D` |

Os três primeiros já estão em `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
e registrados no `Contents.json`. Para a web, `public/favicon.png`,
`public/app-icon.png` e `public/apple-touch-icon.png`.

## Regras seguidas

- 1024×1024, **sem canal alpha** e com **cantos retos** no arquivo-fonte: o iOS
  aplica a máscara arredondada sozinho. Cantos já arredondados criam borda dupla.
- Letra ocupando 58% da largura, centralizada.

## Como regerar

O script que gera todos os tamanhos está no histórico do projeto; qualquer
mudança de cor ou proporção é feita recortando o glifo do wordmark e
recolorindo, para a letra nunca sair diferente da marca.
