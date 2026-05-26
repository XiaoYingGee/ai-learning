// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'AI Agent 学习指南',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/XiaoYingGee/ai-learning' }],
			sidebar: [
				{
					label: '第 1 章：LLM 基础',
					autogenerate: { directory: '01-llm-fundamentals' },
				},
				{
					label: '第 2 章：Agent 设计模式',
					autogenerate: { directory: '02-agent-patterns' },
				},
				{
					label: '第 3 章：Tool Use',
					autogenerate: { directory: '03-tool-use' },
				},
				{
					label: '第 4 章：RAG 深入',
					autogenerate: { directory: '04-rag' },
				},
				{
					label: '第 5 章：框架对比',
					autogenerate: { directory: '05-frameworks' },
				},
				{
					label: '第 6 章：编码实战',
					autogenerate: { directory: '06-coding' },
				},
				{
					label: '第 7 章：生产化',
					autogenerate: { directory: '07-production' },
				},
				{
					label: '第 8 章：安全与对齐',
					autogenerate: { directory: '08-security' },
				},
				{
					label: '第 9 章：系统设计题',
					autogenerate: { directory: '09-system-design' },
				},
				{
					label: '第 10 章：面试冲刺',
					autogenerate: { directory: '10-interview' },
				},
				{
					label: '第 11 章：推荐资源',
					autogenerate: { directory: '11-resources' },
				},
			],
		}),
	],
});
