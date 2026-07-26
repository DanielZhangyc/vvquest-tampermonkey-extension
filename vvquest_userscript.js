// ==UserScript==
// @name         VVQuest - VV表情包助手
// @namespace    https://zvv.quest/
// @version      0.2.4
// @description  基于 VVQuest 项目的表情包检索工具，适用于新版百度贴吧和知乎
// @author       xy0v0
// @match        *://*.baidu.com/*
// @match        *://*.zhihu.com/*
// @icon         https://cn-sy1.rains3.com/pic/pic/2025/03/e0607ef1dfd70ae54612c795de0c4de5.png
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        GM_notification
// @grant        GM_addStyle
// @connect      api.zvv.quest
// @license      CC BY-NC-SA 4.0
// ==/UserScript==

(function() {
    'use strict';

    // 脚本配置
    const config = {
        apiUrl: 'https://api.zvv.quest/search',
        enhancedApiUrl: 'https://api.zvv.quest/enhancedsearch',
        cooldownTime: 3000, // 无联网搜索时冷却时间，单位毫秒
        enhancedCooldownTime: 10000, // 联网搜索时冷却时间，单位毫秒
        lastRequestTime: 0,
        enableNetworkSearch: false, // 是否启用联网搜索功能
        isSearching: false, // 是否正在搜索
    };

    // 添加样式
    GM_addStyle(`
        :root {
            --modal-open-dur: 250ms;
            --modal-close-dur: 150ms;
            --modal-scale: 0.96;
            --modal-scale-close: 0.96;
            --modal-ease: cubic-bezier(0.22, 1, 0.36, 1);
            --acc-expand: 250ms;
            --acc-collapse: 250ms;
            --acc-chevron: 250ms;
            --acc-ease: cubic-bezier(0.22, 1, 0.36, 1);
            --vvquest-press-dur: 140ms;
            --vvquest-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
        }

        /* 统一的按钮样式，基于知乎样式 */
        .vvquest-btn {
            -webkit-tap-highlight-color: transparent;
            appearance: none;
            background-color: #4776f6;
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.16);
            border-radius: 8px;
            padding: 8px 15px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            margin: 0 8px;
            transition:
                transform var(--vvquest-press-dur) var(--vvquest-ease-out),
                background-color 160ms ease,
                border-color 160ms ease,
                box-shadow 160ms ease;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            box-shadow:
                0 1px 2px rgba(0, 0, 0, 0.16),
                0 4px 12px rgba(71, 118, 246, 0.24);
            will-change: transform;
        }

        /* 搜索区域样式 */
        .vvquest-search-section {
            margin-bottom: 15px;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            overflow: hidden;
        }
        .vvquest-section-header {
            appearance: none;
            width: 100%;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 15px;
            background-color: #f5f5f5;
            border: 0;
            border-bottom: 1px solid transparent;
            cursor: pointer;
            text-align: left;
            transition:
                background-color 150ms ease,
                border-color 150ms ease;
        }
        .t-acc[data-open="true"] .vvquest-section-header {
            border-bottom-color: #e0e0e0;
        }
        .vvquest-section-header:focus {
            outline: none;
        }
        .vvquest-section-header:focus-visible {
            outline: 3px solid rgba(71, 118, 246, 0.28);
            outline-offset: -3px;
        }
        .vvquest-section-title {
            font-weight: bold;
            color: #333;
        }
        .vvquest-toggle-btn {
            color: #666;
            width: 24px;
            height: 24px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }
        .vvquest-toggle-btn svg {
            width: 18px;
            height: 18px;
        }

        /* grid-template-rows 0fr → 1fr gives a clean height animation
           with no JS measurement; the inner element clips overflow. */
        .t-acc-panel {
          display: grid;
          grid-template-rows: 0fr;
          transition: grid-template-rows var(--acc-collapse) var(--acc-ease);
        }
        .t-acc[data-open="true"] .t-acc-panel {
          grid-template-rows: 1fr;
          transition: grid-template-rows var(--acc-expand) var(--acc-ease);
        }
        .t-acc-panel-inner {
          overflow: hidden;
          opacity: 0;
          filter: blur(2px);
          transition:
            opacity var(--acc-collapse) var(--acc-ease),
            filter var(--acc-collapse) var(--acc-ease);
        }
        .t-acc[data-open="true"] .t-acc-panel-inner {
          opacity: 1;
          filter: blur(0);
          transition:
            opacity var(--acc-expand) var(--acc-ease),
            filter var(--acc-expand) var(--acc-ease);
        }
        /* Flip the chevron vertically to turn the "v" into a "^".
           scaleY(-1) about the centre passes through a flat line at
           the midpoint (same look as a d path morph) but animates
           in every browser. */
        .t-acc-chevron {
          display: inline-flex;
          transform: scaleY(1);
          transform-origin: center;
          transition: transform var(--acc-chevron) var(--acc-ease);
        }
        .t-acc-chevron path { vector-effect: non-scaling-stroke; }
        .t-acc[data-open="true"] .t-acc-chevron {
          transform: scaleY(-1);
        }

        @media (prefers-reduced-motion: reduce) {
          .t-acc-panel, .t-acc-panel-inner, .t-acc-chevron {
            transition: none !important;
          }
        }

        .vvquest-search-content-body {
            padding: 15px;
        }
        .vvquest-btn:active {
            transform: scale(0.97);
            box-shadow:
                0 1px 2px rgba(0, 0, 0, 0.16),
                0 2px 6px rgba(71, 118, 246, 0.2);
        }
        .vvquest-btn:focus-visible {
            outline: 3px solid rgba(71, 118, 246, 0.32);
            outline-offset: 2px;
        }
        @media (hover: hover) and (pointer: fine) {
            .vvquest-btn:hover {
                background-color: #3e6cee;
                border-color: rgba(255, 255, 255, 0.24);
                box-shadow:
                    0 1px 2px rgba(0, 0, 0, 0.16),
                    0 6px 16px rgba(71, 118, 246, 0.3);
            }
        }

        /* 其他样式保持不变 */
        .vvquest-floating-btn {
            position: fixed;
            right: 20px;
            bottom: 20px;
            z-index: 9999;
            width: auto;
            height: auto;
            padding: 10px 16px;
            font-size: 16px;
        }

        /* 新版贴吧底部讨论栏按钮。
           按钮挂在 body 下，再根据讨论栏的视口坐标定位，避免被贴吧的
           Flex 布局、点击代理和 React 重绘影响。 */
        .vvquest-tieba-docked-btn {
            position: fixed !important;
            z-index: 9999 !important;
            width: 96px !important;
            min-width: 96px !important;
            height: 36px !important;
            margin: 0 !important;
            padding: 0 16px !important;
            border-radius: 999px !important;
            font-size: 14px !important;
            line-height: 36px !important;
            white-space: nowrap !important;
            box-sizing: border-box !important;
            pointer-events: auto !important;
            transform-origin: center !important;
        }
        .vvquest-tieba-docked-btn:active {
            transform: scale(0.97) !important;
        }

        /* 知乎左下角固定按钮样式 - 继承统一样式 */
        .vvquest-zhihu-btn {
            position: fixed;
            left: 20px;
            bottom: 20px;
            z-index: 9999;
            width: auto;
            height: auto;
            padding: 10px 16px;
            font-size: 16px;
        }
        /* 删除表情图标前缀 */
        .vvquest-zhihu-btn::before {
            content: "";
            margin-right: 0;
        }

        /* 模态框样式优化 */
        .vvquest-modal {
            display: flex;
            position: fixed;
            z-index: 10000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            align-items: center;
            justify-content: center;
            visibility: hidden;
            opacity: 0;
            pointer-events: none;
            background-color: rgba(7, 10, 16, 0.72);
            backdrop-filter: blur(6px);
            overflow: hidden;
            padding: clamp(16px, 3vh, 32px);
            box-sizing: border-box;
            transition: opacity var(--modal-open-dur) var(--modal-ease);
        }
        .vvquest-modal.is-visible {
            visibility: visible;
            opacity: 1;
            pointer-events: auto;
        }
        .vvquest-modal.is-closing {
            visibility: visible;
            opacity: 0;
            pointer-events: none;
            transition: opacity var(--modal-close-dur) var(--modal-ease);
        }
        html.vvquest-modal-open {
            overflow: hidden !important;
        }
        .vvquest-modal-content {
            background: #ffffff;
            margin: 0;
            padding: 0;
            border: none;
            width: 480px;
            max-width: calc(100vw - 32px);
            max-height: calc(100vh - 32px);
            overflow: hidden;
            border-radius: 14px;
            box-shadow: 0 8px 25px rgba(0,0,0,0.25);
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
        }
        .vvquest-modal-content:focus,
        .vvquest-about:focus {
            outline: none;
        }

        .t-modal {
          transform-origin: center;
          transform: scale(var(--modal-scale));
          opacity: 0;
          pointer-events: none;
          transition:
            transform var(--modal-open-dur) var(--modal-ease),
            opacity   var(--modal-open-dur) var(--modal-ease);
          will-change: transform, opacity;
        }
        .t-modal.is-open {
          transform: scale(1);
          opacity: 1;
          pointer-events: auto;
        }
        .t-modal.is-closing {
          transform: scale(var(--modal-scale-close));
          opacity: 0;
          pointer-events: none;
          transition:
            transform var(--modal-close-dur) var(--modal-ease),
            opacity   var(--modal-close-dur) var(--modal-ease);
        }

        @media (prefers-reduced-motion: reduce) {
          .t-modal { transition: none !important; }
        }
        .vvquest-modal-header {
            flex: 0 0 auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 0 20px;
            padding: 20px 0 15px;
            border-bottom: 1px solid #f0f0f0;
            position: relative;
        }
        .vvquest-modal-title {
            font-size: 20px;
            font-weight: bold;
            color: #333;
            position: relative;
        }
        .vvquest-modal-title::after {
            content: '';
            position: absolute;
            bottom: -15px;
            left: 0;
            width: 140px;
            height: 3px;
            background: #3498db;
        }
        .vvquest-modal-scroll {
            flex: 0 1 auto;
            min-height: 0;
            overflow-y: auto;
            overscroll-behavior: contain;
            scrollbar-gutter: stable both-edges;
            scrollbar-width: thin;
            scrollbar-color: rgba(111, 118, 129, 0.5) transparent;
            padding: 20px 20px 24px;
            box-sizing: border-box;
        }
        .vvquest-modal-scroll::-webkit-scrollbar {
            width: 12px;
        }
        .vvquest-modal-scroll::-webkit-scrollbar-track {
            background: transparent;
        }
        .vvquest-modal-scroll::-webkit-scrollbar-thumb {
            background-color: rgba(111, 118, 129, 0.5);
            background-clip: padding-box;
            border: 3px solid transparent;
            border-radius: 999px;
        }
        .vvquest-modal-scroll::-webkit-scrollbar-thumb:hover {
            background-color: rgba(87, 96, 106, 0.68);
        }
        .vvquest-close {
            color: #aaa;
            font-size: 28px;
            font-weight: normal;
            cursor: pointer;
            appearance: none;
            background: transparent;
            border: 0;
            padding: 0;
            transition:
                transform var(--vvquest-press-dur) var(--vvquest-ease-out),
                color 150ms ease,
                background-color 150ms ease;
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
        }
        .vvquest-close:active {
            transform: scale(0.92);
        }
        .vvquest-close:focus-visible {
            outline: 3px solid rgba(71, 118, 246, 0.28);
            outline-offset: 1px;
        }
        @media (hover: hover) and (pointer: fine) {
            .vvquest-close:hover {
                color: #555;
                background-color: #f3f4f6;
            }
        }

        /* 调试内容区样式 */
        .vvquest-content-preview {
            background-color: #f9f9f9;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 10px 12px;
            margin: 12px 0 15px 0;
            max-height: 100px;
            overflow-y: auto;
            font-size: 14px;
            color: #333;
            line-height: 1.5;
        }
        .vvquest-content-preview-title {
            font-weight: bold;
            margin-bottom: 6px;
            color: #0066cc;
            font-size: 15px;
        }
        .vvquest-content-preview-text {
            word-break: break-word;
            white-space: pre-wrap;
        }

        /* 复选框容器样式 */
        .vvquest-checkbox-container {
            display: flex !important;
            align-items: center !important;
            background-color: #f0f8ff !important;
            padding: 10px 12px !important;
            border-radius: 8px !important;
            margin: 15px 0 !important;
            border: 1px solid #d5e9fb !important;
        }
        .vvquest-checkbox {
            margin-right: 10px !important;
            width: 20px !important;
            height: 20px !important;
            position: relative !important;
            cursor: pointer !important;
            accent-color: #3498db !important;
        }
        .vvquest-checkbox + label {
            font-size: 15px !important;
            color: #333 !important;
            cursor: pointer !important;
        }

        /* 搜索按钮样式 */
        .vvquest-search-btn {
            background: #3498db !important;
            color: white !important;
            border: none !important;
            border-radius: 30px !important;
            padding: 12px 0 !important;
            font-size: 16px !important;
            font-weight: bold !important;
            cursor: pointer !important;
            width: 100% !important;
            margin-top: 15px !important;
            margin-bottom: 20px !important;
            box-shadow: 0 2px 10px rgba(52, 152, 219, 0.3) !important;
            text-transform: none !important;
            letter-spacing: normal !important;
            transition:
                transform var(--vvquest-press-dur) var(--vvquest-ease-out),
                background-color 160ms ease,
                box-shadow 160ms ease !important;
        }
        .vvquest-search-btn:active {
            transform: scale(0.98);
            box-shadow: 0 1px 5px rgba(52, 152, 219, 0.24) !important;
        }
        .vvquest-search-btn:focus-visible {
            outline: 3px solid rgba(52, 152, 219, 0.28);
            outline-offset: 2px;
        }
        @media (hover: hover) and (pointer: fine) {
            .vvquest-search-btn:hover {
                background: #2980b9 !important;
                box-shadow: 0 4px 15px rgba(52, 152, 219, 0.42) !important;
            }
        }

        /* 禁用按钮样式 */
        .vvquest-btn-disabled {
            opacity: 0.6 !important;
            cursor: not-allowed !important;
            transform: none !important;
            box-shadow: none !important;
        }

        /* 搜索结果区域样式 */
        .vvquest-results {
            margin-top: 20px;
            display: none;
            flex-direction: column;
            gap: 15px;
            max-height: none;
            overflow: visible;
        }

        /* 调整滚动条样式 */
        .vvquest-results::-webkit-scrollbar {
            width: 6px;
        }

        .vvquest-results::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 10px;
        }

        .vvquest-results::-webkit-scrollbar-thumb {
            background: #888;
            border-radius: 10px;
        }

        .vvquest-results::-webkit-scrollbar-thumb:hover {
            background: #555;
        }

        /* AI解析结果样式 */
        .vvquest-ai-explanation {
            background-color: #f0f8ff;
            border: 1px solid #d1e5f5;
            border-radius: 8px;
            padding: 12px;
            margin-top: 10px;
            margin-bottom: 15px;
            display: none;
            font-size: 14px;
            line-height: 1.5;
            color: #333;
            max-height: 120px;
            overflow-y: auto;
        }

        /* AI解析结果滚动条样式 */
        .vvquest-ai-explanation::-webkit-scrollbar {
            width: 6px;
        }

        .vvquest-ai-explanation::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 10px;
        }

        .vvquest-ai-explanation::-webkit-scrollbar-thumb {
            background: #888;
            border-radius: 10px;
        }

        .vvquest-ai-explanation::-webkit-scrollbar-thumb:hover {
            background: #555;
        }

        /* 表情包项目样式 */
        .vvquest-meme-item {
            background-color: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            padding: 10px;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        /* 表情包图片样式 */
        .vvquest-meme-img {
            max-width: 100%;
            max-height: 200px;
            margin-bottom: 10px;
            border-radius: 4px;
        }

        /* 表情包按钮组样式 */
        .vvquest-meme-actions {
            display: flex;
            gap: 10px;
            width: 100%;
            justify-content: center;
        }

        /* 表情包操作按钮样式 */
        .vvquest-meme-btn {
            background: #f2f2f2;
            color: #333;
            border: none;
            border-radius: 4px;
            padding: 6px 10px;
            font-size: 12px;
            cursor: pointer;
            transition:
                transform var(--vvquest-press-dur) var(--vvquest-ease-out),
                background-color 150ms ease;
        }
        .vvquest-meme-btn:active {
            transform: scale(0.97);
        }
        @media (hover: hover) and (pointer: fine) {
            .vvquest-meme-btn:hover {
                background: #e0e0e0;
            }
        }

        /* 加载指示器样式 */
        .vvquest-loading {
            display: none;
            justify-content: center;
            margin: 20px 0;
        }
        .vvquest-spinner {
            width: 30px;
            height: 30px;
            border: 3px solid rgba(0,0,0,0.1);
            border-radius: 50%;
            border-top-color: #3498db;
            animation: vvquest-spin 1s linear infinite;
        }
        @keyframes vvquest-spin {
            to { transform: rotate(360deg); }
        }

        /* 冷却倒计时样式 */
        .vvquest-cooldown {
            text-align: center;
            color: #e74c3c;
            font-size: 14px;
            margin-top: 10px;
            font-weight: bold;
            display: none;
        }

        /* 滑块容器样式 */
        .vvquest-slider-container {
            margin: 15px 0;
            padding: 10px 12px;
            background-color: #f0f8ff;
            border: 1px solid #d5e9fb;
            border-radius: 8px;
        }

        .vvquest-slider-container label {
            display: block;
            margin-bottom: 8px;
            font-size: 15px;
            color: #333;
        }

        .vvquest-slider {
            width: 100%;
            height: 6px;
            -webkit-appearance: none;
            appearance: none;
            background: #ddd;
            outline: none;
            border-radius: 3px;
            margin: 10px 0;
        }

        .vvquest-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: #3498db;
            cursor: pointer;
            transition:
                transform var(--vvquest-press-dur) var(--vvquest-ease-out),
                background-color 150ms ease;
        }

        .vvquest-slider::-webkit-slider-thumb:active {
            transform: scale(0.94);
        }
        @media (hover: hover) and (pointer: fine) {
            .vvquest-slider::-webkit-slider-thumb:hover {
                background: #2980b9;
                transform: scale(1.08);
            }
        }

        #vvquest-image-count-value {
            font-weight: bold;
            color: #3498db;
        }

        /* 关于按钮样式 */
        .vvquest-about-btn {
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #3498db;
            background-color: transparent;
            border: 0;
            border-radius: 8px;
            position: absolute;
            right: 50px;
            top: 50%;
            transform: translateY(-50%);
            transition:
                transform var(--vvquest-press-dur) var(--vvquest-ease-out),
                color 150ms ease,
                background-color 150ms ease;
            font-size: 14px;
            font-weight: bold;
            height: 36px;
            padding: 0 10px;
        }
        .vvquest-about-btn:active {
            transform: translateY(-50%) scale(0.96);
        }
        @media (hover: hover) and (pointer: fine) {
            .vvquest-about-btn:hover {
                color: #2980b9;
                background-color: #eef6fc;
            }
        }

        /* 关于界面样式 */
        .vvquest-about {
            display: block;
            position: fixed;
            top: 50%;
            left: 50%;
            visibility: hidden;
            opacity: 0;
            pointer-events: none;
            transform: translate(-50%, -50%) scale(var(--modal-scale));
            width: 90%;
            max-width: 450px;
            max-height: 90vh;
            overflow-y: auto;
            background-color: #fff;
            z-index: 11000;
            padding: 20px;
            box-sizing: border-box;
            border-radius: 12px;
            box-shadow: 0 8px 25px rgba(0,0,0,0.3);
            transition:
                transform var(--modal-open-dur) var(--modal-ease),
                opacity var(--modal-open-dur) var(--modal-ease);
            will-change: transform, opacity;
        }
        .vvquest-about.is-open {
            visibility: visible;
            opacity: 1;
            pointer-events: auto;
            transform: translate(-50%, -50%) scale(1);
        }
        .vvquest-about.is-closing {
            visibility: visible;
            opacity: 0;
            pointer-events: none;
            transform: translate(-50%, -50%) scale(var(--modal-scale-close));
            transition:
                transform var(--modal-close-dur) var(--modal-ease),
                opacity var(--modal-close-dur) var(--modal-ease);
        }
        .vvquest-about-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid #f0f0f0;
        }
        .vvquest-about-title {
            font-size: 20px;
            font-weight: bold;
            color: #333;
        }
        .vvquest-about-close {
            color: #aaa;
            font-size: 28px;
            font-weight: normal;
            cursor: pointer;
            appearance: none;
            background: transparent;
            border: 0;
            padding: 0;
            transition:
                transform var(--vvquest-press-dur) var(--vvquest-ease-out),
                color 150ms ease,
                background-color 150ms ease;
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
        }
        .vvquest-about-close:active {
            transform: scale(0.92);
        }
        @media (hover: hover) and (pointer: fine) {
            .vvquest-about-close:hover {
                color: #555;
                background-color: #f3f4f6;
            }
        }
        .vvquest-about-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 10px 0;
        }
        .vvquest-about-avatar {
            width: 100px;
            height: 100px;
            border-radius: 50%;
            object-fit: cover;
            border: 3px solid #3498db;
            box-shadow: 0 3px 10px rgba(0,0,0,0.1);
            margin-bottom: 15px;
        }
        .vvquest-about-name {
            font-size: 24px;
            font-weight: bold;
            color: #333;
            margin-bottom: 5px;
        }
        .vvquest-about-description {
            font-size: 14px;
            color: #666;
            text-align: center;
            margin-bottom: 20px;
            line-height: 1.6;
        }
        .vvquest-about-links {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 15px;
            margin-top: 10px;
            width: 100%;
        }
        .vvquest-about-link {
            display: flex;
            align-items: center;
            background-color: #f8f9fa;
            padding: 10px 15px;
            border-radius: 30px;
            text-decoration: none;
            color: #333;
            font-size: 14px;
            transition:
                transform var(--vvquest-press-dur) var(--vvquest-ease-out),
                background-color 150ms ease,
                border-color 150ms ease,
                box-shadow 150ms ease;
            border: 1px solid #eee;
        }
        .vvquest-about-link-icon {
            width: 18px;
            height: 18px;
            margin-right: 8px;
            display: inline-flex;
            flex: 0 0 auto;
        }
        .vvquest-about-link-icon svg {
            width: 100%;
            height: 100%;
            fill: none;
            stroke: currentColor;
            stroke-width: 2;
            stroke-linecap: round;
            stroke-linejoin: round;
        }
        .vvquest-about-link:active {
            transform: scale(0.97);
        }
        @media (hover: hover) and (pointer: fine) {
            .vvquest-about-link:hover {
                background-color: #f0f0f0;
                border-color: #ddd;
                box-shadow: 0 2px 6px rgba(0,0,0,0.08);
            }
        }
        .vvquest-icon-bilibili {
            color: #00a1d6;
        }
        .vvquest-icon-home {
            color: #3498db;
        }
        .vvquest-icon-blog {
            color: #2ecc71;
        }
        .vvquest-icon-afdian {
            color: #946ce6;
        }
        @media (prefers-reduced-motion: reduce) {
            .vvquest-modal,
            .vvquest-about,
            .vvquest-btn,
            .vvquest-search-btn,
            .vvquest-meme-btn,
            .vvquest-close,
            .vvquest-about-close,
            .vvquest-about-link {
                transition-duration: 0.01ms !important;
            }
        }
    `);

    // 网站集成基类
    class SiteIntegration {
        constructor() {
            this.initUI();
            this.addEventListeners();
        }

        // 初始化UI
        initUI() {
            this.createButton();
            this.createVVQuestModal();
        }

        // 创建按钮 - 由子类实现
        createButton() {
            throw new Error('createButton must be implemented by subclass');
        }

        // 获取内容 - 由子类实现
        getContent() {
            throw new Error('getContent must be implemented by subclass');
        }

        // 创建VVQuest模态框
        createVVQuestModal() {
            const modal = document.createElement('div');
            modal.className = 'vvquest-modal';
            modal.id = 'vvquest-modal';
            modal.setAttribute('aria-hidden', 'true');

            modal.innerHTML = `
                <div class="vvquest-modal-content t-modal" role="dialog" aria-modal="true" aria-labelledby="vvquest-modal-title" tabindex="-1">
                    <div class="vvquest-modal-header">
                        <div class="vvquest-modal-title" id="vvquest-modal-title">VVQuest 表情包助手</div>
                        <button type="button" class="vvquest-about-btn" title="关于作者">
                            关于
                        </button>
                        <button type="button" class="vvquest-close" aria-label="关闭 VVQuest">&times;</button>
                    </div>

                    <div class="vvquest-modal-scroll">
                        <!-- 搜索区域（可折叠） -->
                        <div class="vvquest-search-section t-acc" id="vvquest-search-section" data-open="true">
                            <button type="button" class="vvquest-section-header t-acc-head" id="vvquest-toggle-search"
                                    title="折叠/展开搜索区域" aria-expanded="true" aria-controls="vvquest-search-content">
                                <span class="vvquest-section-title">搜索区域</span>
                                <span class="vvquest-toggle-btn t-acc-chevron" aria-hidden="true">
                                    <svg viewBox="0 0 16 16">
                                        <path d="M4 6.5L8 10.5L12 6.5"/>
                                    </svg>
                                </span>
                            </button>

                            <div class="vvquest-search-content t-acc-panel" id="vvquest-search-content">
                                <div class="vvquest-search-content-inner t-acc-panel-inner">
                                    <div class="vvquest-search-content-body">
                                    <!-- 添加调试内容预览区 -->
                                    <div class="vvquest-content-preview">
                                        <div class="vvquest-content-preview-title">当前检索内容:</div>
                                        <div id="vvquest-content-text" class="vvquest-content-preview-text">
                                            未获取到内容...
                                        </div>
                                    </div>

                                    <div class="vvquest-checkbox-container">
                                        <input type="checkbox" id="vvquest-network-search" class="vvquest-checkbox" ${config.enableNetworkSearch ? 'checked' : ''}>
                                        <label for="vvquest-network-search">启用联网搜索 ( beta，不稳定，遇到错误请关闭 )</label>
                                    </div>

                                    <!-- 图片数量滑块控件 -->
                                    <div class="vvquest-slider-container">
                                        <label for="vvquest-image-count">显示图片数量: <span id="vvquest-image-count-value">5</span></label>
                                        <input type="range" id="vvquest-image-count" class="vvquest-slider" min="1" max="25" value="5">
                                    </div>

                                    <!-- 加载指示器 -->
                                    <div id="vvquest-loading" class="vvquest-loading">
                                        <div class="vvquest-spinner"></div>
                                    </div>

                                    <!-- 冷却倒计时 -->
                                    <div id="vvquest-cooldown" class="vvquest-cooldown">
                                        冷却中，请等待 <span id="vvquest-cooldown-time">0</span> 秒
                                    </div>

                                    <button id="vvquest-search-btn" class="vvquest-search-btn">搜索表情包</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- AI解析结果区域 -->
                        <div id="vvquest-ai-explanation" class="vvquest-ai-explanation"></div>

                        <!-- 搜索结果区域 -->
                        <div id="vvquest-results" class="vvquest-results"></div>
                    </div>

                    <!-- 关于界面 -->
                    <div id="vvquest-about" class="vvquest-about" role="dialog" aria-labelledby="vvquest-about-title" aria-hidden="true" tabindex="-1">
                        <div class="vvquest-about-header">
                            <div class="vvquest-about-title" id="vvquest-about-title">关于作者</div>
                            <button type="button" class="vvquest-about-close" aria-label="关闭关于作者">&times;</button>
                        </div>
                        <div class="vvquest-about-content">
                            <img src="https://www.xy0v0.top/upload/bc0e9b7b-4f68-4ecc-a768-e4ac65c4ac85.png" alt="xy0v0" class="vvquest-about-avatar">
                            <div class="vvquest-about-name">xy0v0</div>
                            <div class="vvquest-about-description">
                                VVQuest 开发者<br>
                                感谢使用我的作品，欢迎关注我的其他平台！
                            </div>
                            <div class="vvquest-about-links">
                                <a href="https://space.bilibili.com/165404794" target="_blank" class="vvquest-about-link">
                                    <span class="vvquest-about-link-icon vvquest-icon-bilibili" aria-hidden="true">
                                        <svg viewBox="0 0 24 24">
                                            <rect width="20" height="15" x="2" y="7" rx="2" ry="2"/>
                                            <polyline points="17 2 12 7 7 2"/>
                                        </svg>
                                    </span>
                                    <span>Bilibili</span>
                                </a>
                                <a href="https://zvv.quest/" target="_blank" class="vvquest-about-link">
                                    <span class="vvquest-about-link-icon vvquest-icon-home" aria-hidden="true">
                                        <svg viewBox="0 0 24 24">
                                            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                                            <polyline points="9 22 9 12 15 12 15 22"/>
                                        </svg>
                                    </span>
                                    <span>项目主站</span>
                                </a>
                                <a href="https://www.xy0v0.top/" target="_blank" class="vvquest-about-link">
                                    <span class="vvquest-about-link-icon vvquest-icon-blog" aria-hidden="true">
                                        <svg viewBox="0 0 24 24">
                                            <path d="M12 7v14"/>
                                            <path d="M3 18a1 1 0 0 1-1-1V5a2 2 0 0 1 2-2h5a3 3 0 0 1 3 3v15a3 3 0 0 0-3-3z"/>
                                            <path d="M21 18a1 1 0 0 0 1-1V5a2 2 0 0 0-2-2h-5a3 3 0 0 0-3 3v15a3 3 0 0 1 3-3z"/>
                                        </svg>
                                    </span>
                                    <span>博客</span>
                                </a>
                                <a href="https://afdian.com/a/xy0v0" target="_blank" class="vvquest-about-link">
                                    <span class="vvquest-about-link-icon vvquest-icon-afdian" aria-hidden="true">
                                        <svg viewBox="0 0 24 24">
                                            <circle cx="12" cy="12" r="10"/>
                                            <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/>
                                            <path d="M12 18V6"/>
                                        </svg>
                                    </span>
                                    <span>爱发电</span>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
        }

        openVVQuestModal(trigger) {
            const modal = document.getElementById('vvquest-modal');
            const dialog = modal && modal.querySelector('.t-modal');
            if (!modal || !dialog) {
                return;
            }

            clearTimeout(this.modalCloseTimer);
            this.lastModalTrigger = trigger || this.lastModalTrigger;
            modal.classList.remove('is-closing');
            dialog.classList.remove('is-closing');
            modal.classList.add('is-visible');
            dialog.classList.add('is-open');
            modal.setAttribute('aria-hidden', 'false');
            document.documentElement.classList.add('vvquest-modal-open');

            if (this.lastModalTrigger) {
                this.lastModalTrigger.setAttribute('aria-expanded', 'true');
            }

            requestAnimationFrame(() => {
                dialog.focus({ preventScroll: true });
            });
        }

        closeVVQuestModal() {
            const modal = document.getElementById('vvquest-modal');
            const dialog = modal && modal.querySelector('.t-modal');
            if (!modal || !dialog || !modal.classList.contains('is-visible')) {
                return;
            }

            clearTimeout(this.modalCloseTimer);
            const closeMs = parseFloat(
                getComputedStyle(document.documentElement).getPropertyValue('--modal-close-dur')
            ) || 150;

            this.closeAboutPanel(false);
            modal.classList.remove('is-visible');
            dialog.classList.remove('is-open');
            modal.classList.add('is-closing');
            dialog.classList.add('is-closing');
            modal.setAttribute('aria-hidden', 'true');

            if (this.lastModalTrigger) {
                this.lastModalTrigger.setAttribute('aria-expanded', 'false');
            }

            this.modalCloseTimer = setTimeout(() => {
                modal.classList.remove('is-closing');
                dialog.classList.remove('is-closing');
                document.documentElement.classList.remove('vvquest-modal-open');

                if (this.restoreModalFocus &&
                    this.lastModalTrigger &&
                    this.lastModalTrigger.isConnected) {
                    this.lastModalTrigger.focus({ preventScroll: true });
                }
            }, closeMs);
        }

        openAboutPanel(trigger) {
            const about = document.getElementById('vvquest-about');
            if (!about) {
                return;
            }

            clearTimeout(this.aboutCloseTimer);
            this.lastAboutTrigger = trigger || this.lastAboutTrigger;
            about.classList.remove('is-closing');
            about.classList.add('is-open');
            about.setAttribute('aria-hidden', 'false');

            requestAnimationFrame(() => {
                about.focus({ preventScroll: true });
            });
        }

        closeAboutPanel(restoreFocus = true) {
            const about = document.getElementById('vvquest-about');
            if (!about ||
                (!about.classList.contains('is-open') &&
                 !about.classList.contains('is-closing'))) {
                return;
            }

            clearTimeout(this.aboutCloseTimer);
            const closeMs = parseFloat(
                getComputedStyle(document.documentElement).getPropertyValue('--modal-close-dur')
            ) || 150;

            about.classList.remove('is-open');
            about.classList.add('is-closing');
            about.setAttribute('aria-hidden', 'true');
            this.aboutCloseTimer = setTimeout(() => {
                about.classList.remove('is-closing');
                if (restoreFocus &&
                    this.restoreAboutFocus &&
                    this.lastAboutTrigger &&
                    this.lastAboutTrigger.isConnected) {
                    this.lastAboutTrigger.focus({ preventScroll: true });
                }
            }, closeMs);
        }

        setSearchSectionOpen(open) {
            const section = document.getElementById('vvquest-search-section');
            const head = document.getElementById('vvquest-toggle-search');
            if (!section || !head) {
                return;
            }

            section.setAttribute('data-open', String(open));
            head.setAttribute('aria-expanded', String(open));
        }

        handleVVQuestButtonClick(event, btn) {
            event.preventDefault();
            event.stopPropagation();

            // 获取内容并显示在预览区
            const content = this.getContent();
            const contentPreview = document.getElementById('vvquest-content-text');
            if (contentPreview) {
                contentPreview.textContent = content || '未获取到内容...';
            }

            // 清除之前的搜索结果
            this.clearResults();

            // 显示模态框
            this.restoreModalFocus = event.detail === 0;
            this.openVVQuestModal(btn);
        }

        // 添加事件监听器
        addEventListeners() {
            this.waitForElement('.vvquest-close', (closeBtn) => {
                closeBtn.addEventListener('click', (event) => {
                    this.restoreModalFocus = event.detail === 0;
                    this.closeVVQuestModal();
                });
            });

            this.waitForElement('#vvquest-network-search', (checkbox) => {
                checkbox.addEventListener('change', () => {
                    config.enableNetworkSearch = checkbox.checked;
                });
            });

            // 添加滑块值变化事件监听器
            this.waitForElement('#vvquest-image-count', (slider) => {
                slider.addEventListener('input', () => {
                    document.getElementById('vvquest-image-count-value').textContent = slider.value;
                });
            });

            // 折叠/展开搜索区域按钮事件
            this.waitForElement('#vvquest-toggle-search', (toggleBtn) => {
                toggleBtn.addEventListener('click', () => {
                    const section = document.getElementById('vvquest-search-section');
                    const open = section.getAttribute('data-open') === 'true';
                    this.setSearchSectionOpen(!open);
                });
            });

            this.waitForElement('#vvquest-search-btn', (searchBtn) => {
                searchBtn.addEventListener('click', () => {
                    // 获取预览区的内容作为搜索内容
                    const questionTitle = document.getElementById('vvquest-content-text').textContent;

                    // 处理请求 - 不再关闭模态框，以便显示结果
                    if (questionTitle.trim() !== '' && questionTitle !== '未获取到内容...') {
                        if (config.enableNetworkSearch) {
                            this.handleUserRequest(questionTitle);
                        } else {
                            // 本地搜索功能
                            this.handleUserRequest(questionTitle);
                        }
                    } else {
                        this.showNotification('未获取到内容，请重试');
                    }
                });
            });

            // 点击模态框外部关闭
            window.addEventListener('click', (event) => {
                const modal = document.getElementById('vvquest-modal');
                if (event.target === modal) {
                    this.closeVVQuestModal();
                }
            });

            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    const about = document.getElementById('vvquest-about');
                    if (about && about.classList.contains('is-open')) {
                        this.restoreAboutFocus = true;
                        this.closeAboutPanel();
                    } else {
                        this.restoreModalFocus = true;
                        this.closeVVQuestModal();
                    }
                }
            });

            // 关于按钮点击事件
            this.waitForElement('.vvquest-about-btn', (aboutBtn) => {
                aboutBtn.addEventListener('click', (event) => {
                    this.restoreAboutFocus = event.detail === 0;
                    this.openAboutPanel(aboutBtn);
                });
            });

            // 关于界面关闭按钮点击事件
            this.waitForElement('.vvquest-about-close', (closeBtn) => {
                closeBtn.addEventListener('click', (event) => {
                    this.restoreAboutFocus = event.detail === 0;
                    this.closeAboutPanel();
                });
            });
        }

        // 工具方法
        waitForElement(selector, callback, maxAttempts = 20, interval = 500) {
            let attempts = 0;

            const checkElement = function() {
                const element = document.querySelector(selector);
                if (element) {
                    callback(element);
                    return;
                }

                attempts++;
                if (attempts < maxAttempts) {
                    setTimeout(checkElement, interval);
                } else {
                    console.log(`未能找到元素: ${selector}`);
                    callback(null);
                }
            };

            checkElement();
        }

        clearResults() {
            const resultsEl = document.getElementById('vvquest-results');
            const explanationEl = document.getElementById('vvquest-ai-explanation');

            if (resultsEl) {
                resultsEl.innerHTML = '';
                resultsEl.style.display = 'none';
            }

            if (explanationEl) {
                explanationEl.innerHTML = '';
                explanationEl.style.display = 'none';
            }
        }

        showNotification(message) {
            GM_notification({
                text: message,
                title: 'VVQuest 表情包助手',
                timeout: 3000
            });
        }

        handleUserRequest(query) {
            // 清除之前的结果
            this.clearResults();

            // 检查冷却时间
            const now = Date.now();
            const currentCooldown = config.enableNetworkSearch ? config.enhancedCooldownTime : config.cooldownTime;

            if (now - config.lastRequestTime < currentCooldown) {
                const remainingTime = Math.ceil((config.lastRequestTime + currentCooldown - now) / 1000);
                this.showCooldown(remainingTime);
                return;
            }

            // 开始搜索
            config.isSearching = true;
            this.showLoading(true);

            // 更新最后请求时间
            config.lastRequestTime = now;

            // 发送API请求
            this.sendAPIRequest(query);
        }

        showCooldown(seconds) {
            const cooldownEl = document.getElementById('vvquest-cooldown');
            const timeEl = document.getElementById('vvquest-cooldown-time');

            if (cooldownEl && timeEl) {
                timeEl.textContent = seconds;
                cooldownEl.style.display = 'block';

                // 禁用搜索按钮
                const searchBtn = document.getElementById('vvquest-search-btn');
                if (searchBtn) {
                    searchBtn.classList.add('vvquest-btn-disabled');
                    searchBtn.disabled = true;
                }

                // 倒计时
                let countdown = seconds;
                const timer = setInterval(() => {
                    countdown--;

                    if (countdown <= 0) {
                        clearInterval(timer);
                        cooldownEl.style.display = 'none';

                        // 恢复搜索按钮
                        if (searchBtn) {
                            searchBtn.classList.remove('vvquest-btn-disabled');
                            searchBtn.disabled = false;
                        }
                    } else {
                        timeEl.textContent = countdown;
                    }
                }, 1000);
            }
        }

        showLoading(show) {
            const loadingEl = document.getElementById('vvquest-loading');

            if (loadingEl) {
                loadingEl.style.display = show ? 'flex' : 'none';
            }

            // 禁用或启用搜索按钮
            const searchBtn = document.getElementById('vvquest-search-btn');
            if (searchBtn) {
                if (show) {
                    searchBtn.classList.add('vvquest-btn-disabled');
                    searchBtn.disabled = true;
                } else {
                    searchBtn.classList.remove('vvquest-btn-disabled');
                    searchBtn.disabled = false;
                }
            }
        }

        sendAPIRequest(query) {
            // 获取图片数量滑块的值
            const imageCount = document.getElementById('vvquest-image-count').value;

            const url = config.enableNetworkSearch
                ? `${config.enhancedApiUrl}?q=${encodeURIComponent(query)}&n=${imageCount}`
                : `${config.apiUrl}?q=${encodeURIComponent(query)}&n=${imageCount}`;

            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                headers: {
                    'Accept': 'application/json'
                },
                onload: function(response) {
                    this.showLoading(false);
                    config.isSearching = false;
                    this.handleAPIResponse(response, config.enableNetworkSearch);
                }.bind(this),
                onerror: function(error) {
                    this.showLoading(false);
                    config.isSearching = false;
                    this.handleAPIError(error);
                }.bind(this)
            });
        }

        handleAPIResponse(response, isEnhanced) {
            try {
                const data = JSON.parse(response.responseText);

                if (data.code === 200) {
                    if (isEnhanced) {
                        // 处理联网搜索结果 - 修改判断逻辑
                        if (data.data && (data.data.memes || data.data.images)) {
                            this.displayEnhancedResults(data.data);
                        } else {
                            this.handleAPIError({ message: '解析联网搜索响应失败' });
                        }
                    } else if (Array.isArray(data.data)) {
                        // 处理普通搜索结果
                        this.displayResults(data.data);
                    } else {
                        this.handleAPIError({ message: '解析API响应失败' });
                    }
                } else {
                    // 处理API返回的错误
                    this.handleAPIError({ message: data.msg || '未找到匹配的表情包' });
                }
            } catch (error) {
                this.handleAPIError({ message: '解析API响应失败: ' + error.message });
            }
        }

        handleAPIError(error) {
            this.showNotification(`出错了: ${error.message || '未知错误'}`);
        }

        displayResults(memeUrls) {
            const resultsEl = document.getElementById('vvquest-results');

            if (resultsEl && memeUrls && memeUrls.length > 0) {
                resultsEl.innerHTML = '';

                memeUrls.forEach((memeUrl) => {
                    resultsEl.appendChild(this.createMemeItem(memeUrl));
                });

                resultsEl.style.display = 'flex';

                // 搜索完成后自动折叠搜索区域
                this.setSearchSectionOpen(false);
            } else {
                this.showNotification('未找到匹配的表情包');
            }
        }

        displayEnhancedResults(data) {
            const resultsEl = document.getElementById('vvquest-results');
            const explanationEl = document.getElementById('vvquest-ai-explanation');

            // 显示AI解析结果
            if (explanationEl && data.explanation) {
                explanationEl.textContent = data.explanation;
                explanationEl.style.display = 'block';
            }

            // 显示表情包结果 - 兼容两种可能的返回格式
            const memeUrls = data.memes || data.images || [];
            if (resultsEl && memeUrls.length > 0) {
                resultsEl.innerHTML = '';

                memeUrls.forEach((memeUrl) => {
                    resultsEl.appendChild(this.createMemeItem(memeUrl));
                });

                resultsEl.style.display = 'flex';

                // 搜索完成后自动折叠搜索区域
                this.setSearchSectionOpen(false);
            } else {
                this.showNotification('未找到匹配的表情包');
            }
        }

        createMemeItem(memeUrl) {
            const item = document.createElement('div');
            item.className = 'vvquest-meme-item';

            // 创建图片元素
            const img = document.createElement('img');
            img.className = 'vvquest-meme-img';
            img.src = memeUrl;
            img.alt = '表情包';
            img.loading = 'lazy';

            // 创建按钮组
            const actions = document.createElement('div');
            actions.className = 'vvquest-meme-actions';

            // 复制图片按钮
            const copyImgBtn = document.createElement('button');
            copyImgBtn.className = 'vvquest-meme-btn';
            copyImgBtn.textContent = '复制图片';
            copyImgBtn.addEventListener('click', () => this.copyImageToClipboard(memeUrl, true));

            // 复制链接按钮
            const copyLinkBtn = document.createElement('button');
            copyLinkBtn.className = 'vvquest-meme-btn';
            copyLinkBtn.textContent = '复制链接';
            copyLinkBtn.addEventListener('click', () => this.copyImageToClipboard(memeUrl, false));

            // 下载图片按钮
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'vvquest-meme-btn';
            downloadBtn.textContent = '下载图片';
            downloadBtn.addEventListener('click', () => this.downloadImage(memeUrl));

            // 组装元素
            actions.appendChild(copyImgBtn);
            actions.appendChild(copyLinkBtn);
            actions.appendChild(downloadBtn);

            item.appendChild(img);
            item.appendChild(actions);

            return item;
        }

        downloadImage(imageUrl) {
            try {
                const link = document.createElement('a');
                link.href = imageUrl;
                link.download = imageUrl.split('/').pop() || 'meme.png';
                link.target = '_blank';
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                this.showNotification('正在下载表情包');
            } catch (error) {
                this.showNotification('下载表情包失败');
                console.error('下载表情包失败:', error);
            }
        }

        copyImageToClipboard(imageUrl, isImage) {
            if (isImage) {
                // 复制图片到剪贴板
                // 创建临时画布来获取图片数据
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = function() {
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);

                        // 尝试用新API复制图片
                        canvas.toBlob(function(blob) {
                            try {
                                // 尝试使用 ClipboardItem API
                                if (navigator.clipboard && navigator.clipboard.write) {
                                    const clipboardItem = new ClipboardItem({ 'image/png': blob });
                                    navigator.clipboard.write([clipboardItem])
                                        .then(() => this.showNotification('表情包已复制到剪贴板'))
                                        .catch(err => {
                                            console.error('复制图片失败:', err);
                                            // 如果新API失败，回退到复制链接
                                            GM_setClipboard(imageUrl);
                                            this.showNotification('复制图片失败，已复制图片链接到剪贴板');
                                        });
                                } else {
                                    // 不支持 ClipboardItem API，复制链接
                                    GM_setClipboard(imageUrl);
                                    this.showNotification('您的浏览器不支持复制图片，已复制图片链接到剪贴板');
                                }
                            } catch (e) {
                                // 处理所有其他错误
                                console.error('复制过程中出错:', e);
                                GM_setClipboard(imageUrl);
                                this.showNotification('复制图片时出错，已复制图片链接到剪贴板');
                            }
                        }.bind(this));
                    } catch (e) {
                        // 画布操作错误
                        console.error('创建画布失败:', e);
                        GM_setClipboard(imageUrl);
                        this.showNotification('复制图片时出错，已复制图片链接到剪贴板');
                    }
                };

                img.onerror = function() {
                    // 图片加载失败
                    console.error('图片加载失败');
                    GM_setClipboard(imageUrl);
                    this.showNotification('图片加载失败，已复制图片链接到剪贴板');
                }.bind(this);

                img.src = imageUrl;
            } else {
                // 直接复制链接
                GM_setClipboard(imageUrl);
                this.showNotification('表情包链接已复制到剪贴板');
            }
        }
    }

    // 百度贴吧集成
    class TiebaIntegration extends SiteIntegration {
        createButton() {
            let placementScheduled = false;
            const schedulePlacement = (mutations = []) => {
                // 自己的按钮与弹窗会持续更新 style/class；忽略这些变更，避免观察器回环。
                if (mutations.length && mutations.every((mutation) => {
                    const target = mutation.target.nodeType === Node.ELEMENT_NODE
                        ? mutation.target
                        : mutation.target.parentElement;
                    return target && target.closest &&
                        target.closest('#vvquest-btn, #vvquest-modal');
                })) {
                    return;
                }

                if (placementScheduled) {
                    return;
                }

                placementScheduled = true;
                requestAnimationFrame(() => {
                    placementScheduled = false;
                    this.ensureButtonPlacement();
                });
            };
            this.scheduleTiebaButtonPlacement = schedulePlacement;

            // 新版贴吧使用异步渲染，首次检查后继续监听讨论栏的出现或重绘
            this.ensureButtonPlacement();
            this.tiebaButtonObserver = new MutationObserver(schedulePlacement);
            this.tiebaButtonObserver.observe(document.documentElement, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class', 'style', 'hidden', 'aria-expanded']
            });
            window.addEventListener('resize', schedulePlacement, { passive: true });
            window.addEventListener('scroll', schedulePlacement, {
                passive: true,
                capture: true
            });
            if (window.visualViewport) {
                window.visualViewport.addEventListener('resize', schedulePlacement, { passive: true });
                window.visualViewport.addEventListener('scroll', schedulePlacement, { passive: true });
            }

            // 页面结构未知或加载失败时仍保留可用的悬浮按钮；
            // 后续一旦识别出底部讨论栏，会自动把同一个按钮贴到目标位置。
            setTimeout(() => {
                if (!document.getElementById('vvquest-btn')) {
                    this.createFloatingButton();
                }
            }, 8000);
        }

        ensureButtonPlacement() {
            const existingBtn = document.getElementById('vvquest-btn');
            const composer = this.findNewTiebaComposer();
            if (composer) {
                this.dockButtonToComposer(composer);
                return;
            }

            // 展开回复框时折叠入口会被贴吧卸载。按钮独立留在 body，
            // 暂时隐藏；入口重新出现后观察器会立即重新定位并显示。
            if (existingBtn &&
                existingBtn.classList.contains('vvquest-tieba-docked-btn')) {
                existingBtn.style.setProperty('display', 'none', 'important');
                existingBtn.setAttribute('aria-hidden', 'true');
                this.tiebaComposer = null;
                if (this.tiebaComposerResizeObserver) {
                    this.tiebaComposerResizeObserver.disconnect();
                }
                return;
            }

            if (!document.getElementById('vvquest-btn')) {
                this.mountButtonForClassicTieba();
            }
        }

        findNewTiebaComposer() {
            const controlSelectors = [
                'textarea[placeholder*="参与讨论"]',
                'input[placeholder*="参与讨论"]',
                '[contenteditable="true"][data-placeholder*="参与讨论"]',
                '[contenteditable="true"][aria-placeholder*="参与讨论"]',
                '[role="textbox"][aria-label*="参与讨论"]',
                'textarea[placeholder*="回复"]',
                '[contenteditable="true"][data-placeholder*="回复"]',
                '[contenteditable="true"][aria-placeholder*="回复"]',
                '[role="textbox"][aria-label*="回复"]'
            ];

            const controlMarkers = Array.from(document.querySelectorAll(controlSelectors.join(',')))
                .filter((element) => {
                    const rect = element.getBoundingClientRect();
                    return rect.width > 0 && rect.height > 0 &&
                        rect.bottom >= window.innerHeight * 0.55;
                })
                .sort((left, right) =>
                    right.getBoundingClientRect().bottom - left.getBoundingClientRect().bottom
                );
            let marker = controlMarkers[0];
            if (!marker) {
                marker = this.findTextMarker([
                    '参与讨论涨经验',
                    '参与讨论',
                    '去APP回复经验更多'
                ]);
            }

            if (!marker) {
                return null;
            }

            const markerRect = marker.getBoundingClientRect();
            // 排除顶部搜索框等区域，只接受页面下半部分的可见回复入口
            if (markerRect.width <= 0 || markerRect.height <= 0 ||
                markerRect.bottom < window.innerHeight * 0.55) {
                return null;
            }

            let element = marker;
            if (['INPUT', 'TEXTAREA'].includes(element.tagName)) {
                element = element.parentElement;
            }

            for (let level = 0; element && level < 7; level++) {
                const rect = element.getBoundingClientRect();
                const style = window.getComputedStyle(element);
                const borderRadius = parseFloat(style.borderRadius) || 0;
                const classHint = `${element.className || ''} ${element.id || ''}`;
                const hasComposerHint = /reply|comment|editor|input|composer/i.test(classHint);
                const isContainer = !['SPAN', 'P', 'INPUT', 'TEXTAREA'].includes(element.tagName);

                if (isContainer && rect.width >= 240 && rect.height >= 36 &&
                    rect.height <= 120 && (borderRadius >= 10 || hasComposerHint)) {
                    // 不在链接或按钮内部嵌套另一个 button，改用其外层作为定位容器
                    if (['A', 'BUTTON', 'LABEL'].includes(element.tagName) && element.parentElement) {
                        return element.parentElement;
                    }
                    return element;
                }

                element = element.parentElement;
            }

            return null;
        }

        findTextMarker(texts) {
            for (const text of texts) {
                const result = document.evaluate(
                    `//text()[contains(normalize-space(.), "${text}")]`,
                    document,
                    null,
                    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                    null
                );
                let bestMarker = null;
                let bestBottom = -1;
                for (let index = 0; index < result.snapshotLength; index++) {
                    const textNode = result.snapshotItem(index);
                    if (!textNode || !textNode.parentElement) {
                        continue;
                    }

                    const rect = textNode.parentElement.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0 &&
                        rect.bottom >= window.innerHeight * 0.55 &&
                        rect.bottom > bestBottom) {
                        bestMarker = textNode.parentElement;
                        bestBottom = rect.bottom;
                    }
                }
                if (bestMarker) {
                    return bestMarker;
                }
            }
            return null;
        }

        dockButtonToComposer(composer) {
            const btn = document.getElementById('vvquest-btn') || this.createVVQuestBtn();
            btn.className = 'vvquest-btn vvquest-tieba-docked-btn';
            btn.removeAttribute('aria-hidden');

            // Portal 到 body：贴吧重绘/替换讨论栏时不会再把按钮一起删掉，
            // 同时按钮也不再属于输入栏的点击区域。
            if (btn.parentElement !== document.body) {
                document.body.appendChild(btn);
            }

            if (this.tiebaComposer !== composer && typeof ResizeObserver !== 'undefined') {
                if (!this.tiebaComposerResizeObserver) {
                    this.tiebaComposerResizeObserver = new ResizeObserver(
                        this.scheduleTiebaButtonPlacement
                    );
                }
                this.tiebaComposerResizeObserver.disconnect();
                this.tiebaComposerResizeObserver.observe(composer);
            }
            this.tiebaComposer = composer;
            this.positionDockedButton(btn, composer);
        }

        positionDockedButton(btn, composer) {
            if (!composer || !composer.isConnected) {
                btn.style.setProperty('display', 'none', 'important');
                btn.setAttribute('aria-hidden', 'true');
                return;
            }

            const rect = composer.getBoundingClientRect();
            const buttonWidth = 96;
            const buttonHeight = 36;
            const rightInset = 6;
            const isVisible = rect.width >= 240 &&
                rect.height >= buttonHeight &&
                rect.bottom > 0 &&
                rect.top < window.innerHeight &&
                rect.right > 0 &&
                rect.left < window.innerWidth;

            if (!isVisible) {
                btn.style.setProperty('display', 'none', 'important');
                btn.setAttribute('aria-hidden', 'true');
                return;
            }

            // 几何定位不依赖贴吧类名：始终右对齐，并在讨论栏中精确垂直居中。
            const top = rect.top + (rect.height - buttonHeight) / 2;
            const left = Math.max(
                rect.left + rightInset,
                rect.right - rightInset - buttonWidth
            );

            btn.style.setProperty('display', 'inline-flex', 'important');
            btn.style.setProperty('top', `${Math.round(top * 2) / 2}px`, 'important');
            btn.style.setProperty('left', `${Math.round(left * 2) / 2}px`, 'important');
            btn.style.removeProperty('right');
            btn.style.removeProperty('bottom');
            btn.removeAttribute('aria-hidden');
        }

        mountButtonForClassicTieba() {
            const selectors = [
                '.j_floating',
                '.tb-exbtn-wrapper',
                '.poster_head',
                '.edui-btn-toolbar',
                '.j_media_box',
                '.tb-editor-toolbar',
                'ul[class^="tbui_aside_float_bar"]',
                '.btn_default',
                '.btn_sub',
                '.j_choo',
                '.j_submit'
            ];
            const targetElement = selectors
                .map((selector) => document.querySelector(selector))
                .find(Boolean);

            if (!targetElement || !targetElement.parentNode) {
                return;
            }

            const btn = this.createVVQuestBtn();
            btn.classList.add('vvquest-tieba-classic-btn');
            if (targetElement.tagName === 'UL') {
                const li = document.createElement('li');
                li.dataset.vvquestContainer = 'true';
                li.appendChild(btn);
                targetElement.appendChild(li);
            } else {
                targetElement.parentNode.insertBefore(btn, targetElement.nextSibling);
            }
            console.log('成功将VVQuest按钮插入经典贴吧编辑区');
        }

        getContent() {
            const titleSelectors = [
                '.core_title_txt',
                '[class*="threadTitle"]',
                '[class*="ThreadTitle"]',
                'main h1',
                'h1'
            ];
            const contentSelectors = [
                '.d_post_content',
                '[class*="threadContent"]',
                '[class*="ThreadContent"]',
                '[class*="postContent"]',
                '[class*="PostContent"]',
                'main article'
            ];

            const titleElement = titleSelectors
                .map((selector) => document.querySelector(selector))
                .find((element) => element && element.textContent.trim());
            const postContentElement = contentSelectors
                .map((selector) => document.querySelector(selector))
                .find((element) => element && element.textContent.trim());
            const metaTitle = document.querySelector('meta[property="og:title"]');
            const metaDescription = document.querySelector('meta[name="description"]');

            const title = titleElement
                ? titleElement.textContent.trim()
                : (metaTitle && metaTitle.content.trim()) ||
                  document.title.replace(/[_\-|].*百度贴吧.*$/, '').trim();
            const postContent = postContentElement
                ? postContentElement.textContent.trim()
                : (metaDescription && metaDescription.content.trim()) || '';
            const content = `${title} ${postContent}`.trim();

            console.log('获取到帖子内容:', content);
            return content;
        }

        createVVQuestBtn() {
            const vvquestBtn = document.createElement('button');
            vvquestBtn.className = 'vvquest-btn';
            vvquestBtn.id = 'vvquest-btn';
            vvquestBtn.type = 'button';
            vvquestBtn.textContent = 'VVQuest';
            vvquestBtn.title = '使用VVQuest搜索表情包';
            vvquestBtn.setAttribute('aria-haspopup', 'dialog');
            vvquestBtn.setAttribute('aria-controls', 'vvquest-modal');
            vvquestBtn.setAttribute('aria-expanded', 'false');
            vvquestBtn.addEventListener('click', (event) => {
                this.handleVVQuestButtonClick(event, vvquestBtn);
            });
            return vvquestBtn;
        }

        createFloatingButton() {
            const floatingBtn = document.getElementById('vvquest-btn') || this.createVVQuestBtn();
            floatingBtn.className = 'vvquest-btn vvquest-floating-btn';
            if (!floatingBtn.isConnected) {
                document.body.appendChild(floatingBtn);
            }
        }
    }

    // 知乎集成
    class ZhihuIntegration extends SiteIntegration {
        createButton() {
            const zhihuBtn = document.createElement('button');
            zhihuBtn.className = 'vvquest-btn vvquest-zhihu-btn';
            zhihuBtn.id = 'vvquest-btn';
            zhihuBtn.textContent = 'VVQuest';
            zhihuBtn.title = '使用VVQuest搜索表情包';
            zhihuBtn.type = 'button';
            zhihuBtn.setAttribute('aria-haspopup', 'dialog');
            zhihuBtn.setAttribute('aria-controls', 'vvquest-modal');
            zhihuBtn.setAttribute('aria-expanded', 'false');
            zhihuBtn.addEventListener('click', (event) => {
                this.handleVVQuestButtonClick(event, zhihuBtn);
            });

            document.body.appendChild(zhihuBtn);
            console.log('成功创建知乎左下角固定按钮');
        }

        getContent() {
            let title = '';

            // 尝试多个可能的选择器来获取知乎问题标题
            const selectors = [
                '.QuestionHeader-title',
                'h1.QuestionHeader-title',
                '.QuestionPage .QuestionHeader .QuestionHeader-title',
                '.Question-title',
                '.zm-item-title',
                'h1[data-zop-question]'
            ];

            for (const selector of selectors) {
                const titleElement = document.querySelector(selector);
                if (titleElement) {
                    title = titleElement.textContent.trim();
                    console.log('获取到知乎问题标题:', title);
                    break;
                }
            }

            // 如果没找到标题，尝试获取当前页面标题
            if (!title) {
                title = document.title.replace(' - 知乎', '').trim();
                console.log('使用页面标题作为知乎问题:', title);
            }

            return title;
        }
    }

    // 初始化函数
    function init() {
        console.log('VVQuest 表情包助手已加载');

        // 检测当前网站并初始化对应的集成类
        if (location.hostname.includes('tieba.baidu.com')) {
            console.log('检测到百度贴吧网站');
            new TiebaIntegration();
        } else if (location.hostname.includes('zhihu.com')) {
            console.log('检测到知乎网站');
            new ZhihuIntegration();
        }
    }

    // 启动脚本
    init();
})();
