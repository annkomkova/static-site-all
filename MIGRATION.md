# Миграция webpack 5 → Vite

Собрано и проверено локально (`npm install && npm run build`, плюс `npm run dev`)
— сборка проходит без ошибок, все 15 страниц собираются в `docs/`.

## Что изменилось в конфигурации

- `config/webpack.*.js` → один `vite.config.js` в корне.
  - `root: 'src'` — структура `src/` не менялась, все пути те же.
  - `base` — `/static-site-09-25/` при `vite build` (совпадает с тем, что
    у тебя было захардкожено в `og:url`, sitemap и т.д.), `/` при `vite dev`.
  - `build.outDir: 'docs'` — как и раньше, GitHub Pages отдаёт из `docs/`.
    Отдельная `dev_build` папка больше не нужна: dev-сервер Vite отдаёт
    файлы из памяти, ничего не пишет на диск.
  - `rollupOptions.input` — явный список всех 15 HTML-страниц.
  - **Чанки на страницу — тоже одним объектом**, `pages` в
    `vite.config.js`: `{ имя: { file: '...', chunks: [...] } }`
    (прямая замена `webpack.pages.js`). Сами `.html`-файлы не содержат
    ни одного `<script>` тега на JS — их подставляет плагин
    `pageChunksPlugin` через `transformIndexHtml` (тот же API, которым
    сам Vite добавляет свои служебные теги), сопоставляя обрабатываемый
    файл с картой `chunksByFile`. Правишь чанки страницы — трогаешь
    только этот объект, не бегаешь по `.html` файлам.
- **JSX/Babel** — `@babel/preset-env` + `@babel/preset-react` убраны,
  JSX и современный JS транспилирует esbuild внутри Vite/`@vitejs/plugin-react`.
  Быстрее и конфигурировать нечего.
- **CSS** — `css-loader`/`mini-css-extract-plugin`/`postcss-loader` убраны,
  это всё у Vite из коробки. **Важно**: `postcss.config.js` раньше не было
  вообще, поэтому `postcss-nested`, `postcss-preset-env` и `autoprefixer`
  были в `devDependencies`, но реально ни разу не подключались и не
  работали. Я добавил `postcss.config.js`, который их наконец включает —
  проверь, что автопрефиксы/нестинг не сломали существующую вёрстку
  (не должны, но это меняющееся поведение, а не 1-в-1 копия старого).
- **Картинки и шрифты** — `asset/resource` с `images/[hash][ext]` /
  `fonts/[hash][ext]` заменены на дефолтный ассет-пайплайн Vite
  (`docs/assets/<name>-<hash>.<ext>`). Пути в HTML/CSS/JS трогать не
  пришлось — Vite сам находит `<img src="...">`, `url()` в CSS и `import`
  в JS.
- **Sitemap** — `sitemap-webpack-plugin` заменён маленьким плагином в
  `vite.config.js`, который пишет `docs/sitemap.xml` с тем же списком
  страниц и тем же base URL.
- **Партиалы `<analytics>` / `<footerPartial>`** — вместо
  `html-webpack-partials-plugin` — свой плагин `htmlPartialsPlugin`
  (хук `transformIndexHtml`), который просто подставляет содержимое
  `src/partials/analytics.html` и `src/partials/footer.html` вместо
  этих тегов. Работает и в dev, и в build.

  Отдельно про баг, который был в первой версии миграции: `<analytics>`
  в исходниках стоит ПЕРЕД `<meta charset="UTF-8">`. `html-webpack-plugin`
  в старом стеке сам поднимал `<meta charset>` в самое начало `<head>`
  независимо от того, где он в шаблоне — это его штатное поведение.
  Мой плагин на первых порах делал наивную строковую замену на месте,
  из-за чего партиал аналитики (~1 КБ) оказывался перед charset,
  объявление кодировки уезжало за пределы первых 1024 байт документа —
  и браузер угадывал кодировку сам, отсюда кракозябры вместо кириллицы
  на всех страницах. Починил: плагин теперь после подстановки партиалов
  явно выносит `<meta charset>` первым дочерним элементом `<head>`,
  так же как делал html-webpack-plugin.
- **`airtable` в `articles.js`** — библиотека формально тянет node-модуль
  `stream`, поэтому первой версией миграции я добавил
  `vite-plugin-node-polyfills`. Это оказалось лишним и вредным: на
  проекте с 15 HTML-точками входа плагин ловит известный баг esbuild
  (`cannot be marked as external` при сканировании зависимостей —
  https://github.com/davidmyersdev/vite-plugin-node-polyfills/issues,
  конфликт возникает именно при нескольких entry-points). Проверил
  сборку и dev-сервер без плагина — `stream` в браузерной сборке airtable
  реально не требуется, ни `vite build`, ни `vite dev` на него не
  жалуются. Плагин убран.

## Единственное содержательное изменение — рендер меню на `articles`/`tests`/`dictionary`

В оригинале эти три страницы были `.ejs`, а не `.html`:

```ejs
<% const {menubar} = require('../javascripts/menubar.js') %>
...
<%= menubar %>
```

`menubar.js` на этапе **сборки HTML** (в Node) рендерил `C_MenuLinks.jsx`
через `ReactDOMServer.renderToString` и вставлял готовую HTML-строку в
шаблон. Это специфика html-webpack-plugin + ejs — Vite так на этапе
генерации HTML JSX не гоняет (и городить для одного этого мини-SSR ради
трёх статичных ссылок в меню не имеет смысла).

Я сделал это так же, как у тебя уже сделаны `searchReact.jsx` и
`reactBasics.jsx` рядом — рендер на клиенте:

- `.ejs` → `.html` (обычные статические страницы, EJS вообще не нужен —
  единственным использованием EJS был именно этот `require`/`<%= %>`);
- `<%= menubar %>` → `<div class="O_MenuLinks"></div>` (точка монтирования);
- новый файл `src/javascripts/menubar.jsx`, который монтирует
  `<C_MenuLinks />` в этот div, подключён `<script type="module">` на
  тех же трёх страницах.

Визуально ничего не меняется (в CSS нет правил на `.C_MenuLinks`, которые
зависели бы от того, что он прямой потомок `<nav>`), но теперь меню на
секунду позже появляется на экране (гидратация на клиенте, а не готовая
разметка в HTML) — на медленных устройствах это может быть заметно как
короткое "мигание" пустого места в навигации. Если это важно, самый
простой SSR-вариант для Vite — `vite-plugin-ejs` с `data`, куда вручную
вычисляется `menubar` строкой в `vite.config.js`; могу добавить, если
нужно сохранить именно server-render.

## Что НЕ менялось (намеренно)

- `src/share/CNAME` по-прежнему никуда не копируется — в старом конфиге
  `CopyWebpackPlugin` для этого был закомментирован, я сохранил как есть.
  Если нужен кастомный домен на GitHub Pages, добавь копирование в
  `vite.config.js` (`closeBundle`) или положи `CNAME` в `src/public/`.
- Все относительные ссылки (`pages/articles.html`, `../images/...` и т.д.)
  не трогал — они у тебя уже написаны относительно, поэтому работают
  вне зависимости от `base`.
- `menubarData.js` — там `homeURL` захардкожен на `localhost:8080`
  (порт webpack-dev-server). Vite dev-сервер по умолчанию поднимается
  на 5173, так что при локальной разработке ссылки в меню на
  `articles`/`tests`/`dictionary` будут вести на несуществующий порт —
  это было так же нерабочим и до миграции, не трогал бизнес-логику.

## Команды

| было | стало |
|---|---|
| `yarn start` (webpack serve) | `yarn dev` / `npm run dev` |
| `yarn watch` | не нужен — `dev` уже watch-режим |
| `yarn build` | `yarn build` / `npm run build` (собирает в `docs/`) |
| — | `yarn preview` — локально посмотреть прод-сборку из `docs/` |
