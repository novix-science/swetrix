import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
const require = createRequire(new URL('../web/package.json', import.meta.url))
const { createServer } = await import(pathToFileURL(require.resolve('vite')).href)
const harness = '\0traffic-flow-test'
const context = '\0traffic-flow-context'
const server = await createServer({
  configFile: false, root: fileURLToPath(new URL('../web', import.meta.url)),
  resolve: { alias: { '~': fileURLToPath(new URL('../web/app', import.meta.url)) } },
  server: { middlewareMode: true, watch: null, ws: false }, logLevel: 'silent',
  plugins: [{ name: 'traffic-flow-test', enforce: 'pre',
    resolveId(id) {
      if (id === 'virtual:traffic-flow-test') return harness
      if (/\/View\/ViewProject(?:\.tsx)?$/.test(id)) return context
    },
    load(id) {
      if (id === context) return `import { useSearchParams } from 'react-router';
        export const useViewProjectContext = () => {const [p] = useSearchParams(); return {period:p.get('period') || '7d', timeBucket:'day', timezone:p.get('timezone') || 'Asia/Shanghai'};};`
      if (id !== harness) return
      return `
        import React from 'react';
        import { renderToStaticMarkup } from 'react-dom/server';
        import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
        import { createInstance } from 'i18next';
        import { I18nextProvider } from 'react-i18next';
        import { MemoryRouter } from 'react-router';
        import Overview from '~/pages/Project/tabs/Funnels/TrafficFlowOverview';
        import { ReportError } from '~/pages/Project/tabs/Business/report';
        import { trafficFlowQuery } from '~/pages/Project/tabs/Funnels/trafficFlow';
        export { validateTrafficFlow, trafficFlowQuery, lastDaysParams } from '~/pages/Project/tabs/Funnels/trafficFlow';
        export async function renderCase(data, state = {}, search = '?tab=funnels&period=7d', cachedSearch = search, language = 'zh') {
          const client = new QueryClient({ defaultOptions: { queries: { retryOnMount: false } } });
          const p = new URLSearchParams(cachedSearch);
          const query = trafficFlowQuery(p, p.get('period') || '7d', 'day', p.get('timezone') || 'Asia/Shanghai');
          const key = ['v2', 'project12345', 'traffic-flow-v1', query];
          const cached = client.getQueryCache().build(client, { queryKey: key });
          if (data) client.setQueryData(key, data);
          cached.setState({ ...state, ...(state.error ? {error:new ReportError(503, 'request_failed')} : {}) });
          const i18n = createInstance();
          await i18n.init({lng:language, resources:{[language]:{common:{}}}});
          const html = renderToStaticMarkup(React.createElement(I18nextProvider, {i18n},
            React.createElement(QueryClientProvider, {client}, React.createElement(MemoryRouter, {initialEntries:[search]}, React.createElement(Overview,{projectId:'project12345'})))));
          client.clear(); return html;
        }
      `
    },
  }],
})
let loaded
try { loaded = await server.ssrLoadModule('virtual:traffic-flow-test') } finally { await server.close() }
export const { renderCase, validateTrafficFlow, trafficFlowQuery, lastDaysParams } = loaded
