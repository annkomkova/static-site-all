import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, 'src')
const outDir = path.resolve(__dirname, 'docs')

// --- единая карта страниц: файл + какие JS-чанки на неё подключить ---
// (замена webpack.pages.js — теперь это единственное место, где нужно
// прописывать, что подключено к какой странице; сами .html файлы
// никаких <script> тегов не содержат, их проставляет pageChunksPlugin ниже)
const pages = {
  main: {
    file: 'index.html',
    chunks: ['/javascripts/index.js', '/javascripts/basic.js', '/javascripts/searchVanilla.js']
  },
  styleguide: {
    file: 'styleguide.html',
    chunks: ['/javascripts/styleguide.js', '/javascripts/basic.js']
  },
  search: {
    file: 'search.html',
    chunks: ['/javascripts/searchModule.js', '/javascripts/basic.js']
  },
  articles: {
    file: 'pages/articles.html',
    chunks: ['/javascripts/menubar.jsx', '/javascripts/articles.js', '/javascripts/basic.js', '/javascripts/searchReact.jsx']
  },
  dictionary: {
    file: 'pages/dictionary.html',
    chunks: ['/javascripts/menubar.jsx', '/javascripts/index.js', '/javascripts/basic.js', '/javascripts/searchVanilla.js']
  },
  tests: {
    file: 'pages/tests.html',
    chunks: ['/javascripts/menubar.jsx', '/javascripts/filterTags.js', '/javascripts/basic.js', '/javascripts/searchVanilla.js']
  },
  theory: {
    file: 'pages/theory.html',
    chunks: ['/javascripts/theory.js', '/javascripts/basic.js']
  },
  reactBasics: {
    file: 'pages/reactBasics.html',
    chunks: ['/javascripts/basic.js', '/javascripts/reactBasics.jsx']
  },
  article1: {
    file: 'pages/articles/article1.html',
    chunks: ['/javascripts/index.js', '/javascripts/basic.js']
  },
  aloe: {
    file: 'pages/articles/aloe.html',
    chunks: ['/javascripts/searchVanilla.js', '/javascripts/basic.js']
  },
  cactus: {
    file: 'pages/articles/cactus.html',
    chunks: ['/javascripts/searchVanilla.js', '/javascripts/basic.js']
  },
  monstera: {
    file: 'pages/articles/monstera.html',
    chunks: ['/javascripts/searchVanilla.js', '/javascripts/basic.js']
  },
  orchidea: {
    file: 'pages/articles/orchidea.html',
    chunks: ['/javascripts/searchVanilla.js', '/javascripts/basic.js']
  },
  sansevieria: {
    file: 'pages/articles/sansevieria.html',
    chunks: ['/javascripts/searchVanilla.js', '/javascripts/basic.js']
  },
  test1: {
    file: 'pages/tests/test1.html',
    chunks: ['/pages/tests/test1.js', '/javascripts/basic.js', '/javascripts/searchVanilla.js']
  }
}

// путь файла (относительно root) -> список чанков, для быстрого поиска в плагине
const chunksByFile = Object.fromEntries(
  Object.values(pages).map(({ file, chunks }) => [file, chunks])
)

// список для sitemap.xml (замена sitemap-webpack-plugin)
const sitemapPaths = [
  '/static-site-09-25/index.html',
  '/static-site-09-25/styleguide.html',
  '/static-site-09-25/search.html',
  '/static-site-09-25/pages/articles.html',
  '/static-site-09-25/pages/dictionary.html',
  '/static-site-09-25/pages/tests.html',
  '/static-site-09-25/pages/theory.html',
  '/static-site-09-25/pages/tests/test1.html',
  '/static-site-09-25/pages/articles/article1.html',
  '/static-site-09-25/pages/articles/aloe.html',
  '/static-site-09-25/pages/articles/cactus.html',
  '/static-site-09-25/pages/articles/monstera.html',
  '/static-site-09-25/pages/articles/orchidea.html',
  '/static-site-09-25/pages/articles/sansevieria.html',
  '/static-site-09-25/pages/reactBasics.html'
]

// --- плагин: подставляет <script type="module"> по карте chunksByFile ---
// (замена автоинжекта чанков из HtmlWebpackPlugin по chunks: [...])
function pageChunksPlugin() {
  return {
    name: 'page-chunks',
    transformIndexHtml(html, ctx) {
      const relFile = path.relative(root, ctx.filename).split(path.sep).join('/')
      const chunks = chunksByFile[relFile]
      if (!chunks) return html

      return {
        html,
        tags: chunks.map((src) => ({
          tag: 'script',
          attrs: { type: 'module', src },
          injectTo: 'body'
        }))
      }
    }
  }
}

// --- плагин для <analytics></analytics> и <footerPartial></footerPartial> ---
// замена html-webpack-partials-plugin: просто подставляет содержимое
// партиалов вместо кастомных тегов, работает и в dev, и в build.
function htmlPartialsPlugin() {
  const partials = {
    analytics: fs.readFileSync(
      path.resolve(root, 'partials/analytics.html'),
      'utf-8'
    ),
    footerPartial: fs.readFileSync(
      path.resolve(root, 'partials/footer.html'),
      'utf-8'
    )
  }

  return {
    name: 'html-partials',
    transformIndexHtml(html) {
      html = html
        .replace(/<analytics\s*\/?>(<\/analytics>)?/g, partials.analytics)
        .replace(
          /<footerPartial\s*\/?>(<\/footerPartial>)?/g,
          partials.footerPartial
        )

      // html-webpack-plugin раньше сам поднимал <meta charset> в самое
      // начало <head> — без этого партиал аналитики (~1 КБ) оказывается
      // ПЕРЕД charset, объявление кодировки уезжает за пределы первых
      // 1024 байт документа, и браузер угадывает кодировку сам — отсюда
      // "кракозябры" вместо кириллицы. Восстанавливаем то же поведение.
      const charsetMatch = html.match(/<meta[^>]+charset[^>]*>\s*/i)
      if (charsetMatch) {
        html = html.replace(charsetMatch[0], '')
        html = html.replace(/<head(\s[^>]*)?>/i, (tag) => `${tag}\n    ${charsetMatch[0].trim()}`)
      }

      return html
    }
  }
}

// --- плагин для sitemap.xml (замена sitemap-webpack-plugin) ---
function sitemapPlugin({ base }) {
  return {
    name: 'sitemap',
    apply: 'build',
    closeBundle() {
      const urls = sitemapPaths
        .map((p) => `  <url><loc>${base}${p}</loc></url>`)
        .join('\n')
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
      fs.mkdirSync(outDir, { recursive: true })
      fs.writeFileSync(path.join(outDir, 'sitemap.xml'), xml)
    }
  }
}

export default defineConfig(({ command }) => ({
  root,
  base: command === 'build' ? '/static-site-09-25/' : '/',
  plugins: [
    react(),
    pageChunksPlugin(),
    htmlPartialsPlugin(),
    sitemapPlugin({ base: 'https://annkomkova.github.io' })
  ],
  build: {
    outDir,
    emptyOutDir: true,
    rollupOptions: {
      input: Object.fromEntries(
        Object.entries(pages).map(([name, { file }]) => [
          name,
          path.resolve(root, file)
        ])
      )
    }
  },
  server: {
    open: true
  }
}))
