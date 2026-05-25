# Diagnóstico do mapa em branco na home Rocha

Data: 2026-05-25

## Evidência visual

Na seção `Onde nos encontrar`, o endereço cadastrado aparece corretamente e o link `Abrir rota` é gerado com a consulta do Google Maps. Porém, o container superior do mapa fica vazio.

## Evidência técnica no navegador

Inspeção em produção em `https://rocha.fullreparo.com.br/` mostrou:

| Item | Resultado |
|---|---|
| `window.google` | `false` |
| `window.google.maps` | `false` |
| Container do mapa | presente (`h-52`) |
| Script injetado | `https://forge.butterfly-effect.dev/v1/maps/proxy/maps/api/js?key=&v=weekly&libraries=marker,places,geocoding,geometry` |

## Causa provável

O componente `MapView` usa `import.meta.env.VITE_FRONTEND_FORGE_API_KEY`. Em produção, essa variável foi compilada vazia, gerando `key=` no script. Como o script do Google Maps não carrega, o componente fica apenas com uma div vazia, sem fallback visual.

## Direção da correção

A correção deve evitar área em branco. Há duas opções seguras:

1. Ajustar o componente para usar um embed público do Google Maps via `iframe` com o endereço codificado, sem depender da chave do proxy para a home pública.
2. Manter o `MapView` apenas onde houver chave configurada e renderizar fallback informativo quando a API não estiver disponível.

Para a home pública, a opção 1 é a mais adequada porque o usuário já possui endereço e link de rota; o mapa pode ser exibido diretamente pelo endereço.
