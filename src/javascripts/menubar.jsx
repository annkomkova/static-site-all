import React from 'react'
import { createRoot } from 'react-dom/client'

import C_MenuLinks from '../components/C_MenuLinks.jsx'
import { props } from './menubarData.js'

// раньше меню рендерилось в HTML-строку на этапе сборки внутри EJS
// (require('react-dom/server') прямо в шаблоне). Vite не даёт так же
// удобно гонять JSX через Node на этапе генерации HTML, поэтому меню
// рендерится на клиенте — как и searchReact.jsx/reactBasics.jsx рядом.
const container = document.querySelector('.O_MenuLinks')

if (container) {
  createRoot(container).render(<C_MenuLinks {...props} />)
}
