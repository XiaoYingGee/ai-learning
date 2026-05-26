// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// https://astro.build/config
export default defineConfig({
	markdown: {
		remarkPlugins: [remarkMath],
		rehypePlugins: [rehypeKatex],
	},
	integrations: [
		starlight({
			title: 'AI Agent 学习指南',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/XiaoYingGee/ai-learning' }],
			head: [
				{
					tag: 'link',
					attrs: {
						rel: 'stylesheet',
						href: 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css',
					},
				},
			],
			sidebar: [
				{
					label: '第 1 章：LLM 基础',
					items: [{ autogenerate: { directory: '01-llm-fundamentals' } }],
				},
				{
					label: '第 2 章：Agent 设计模式',
					items: [{ autogenerate: { directory: '02-agent-patterns' } }],
				},
				{
					label: '第 3 章：Tool Use',
					items: [{ autogenerate: { directory: '03-tool-use' } }],
				},
				{
					label: '第 4 章：RAG 深入',
					items: [{ autogenerate: { directory: '04-rag' } }],
				},
				{
					label: '第 5 章：框架对比',
					items: [{ autogenerate: { directory: '05-frameworks' } }],
				},
				{
					label: '第 6 章：编码实战',
					items: [{ autogenerate: { directory: '06-coding' } }],
				},
				{
					label: '第 7 章：生产化',
					items: [{ autogenerate: { directory: '07-production' } }],
				},
				{
					label: '第 8 章：安全与对齐',
					items: [{ autogenerate: { directory: '08-security' } }],
				},
				{
					label: '第 9 章：系统设计题',
					items: [{ autogenerate: { directory: '09-system-design' } }],
				},
				{
					label: '第 10 章：面试冲刺',
					items: [{ autogenerate: { directory: '10-interview' } }],
				},
				{
					label: '第 11 章：推荐资源',
					items: [{ autogenerate: { directory: '11-resources' } }],
				},
			],
		}),
	],
});
