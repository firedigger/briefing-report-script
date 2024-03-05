import * as cheerio from 'cheerio';
import TelegramBot from 'node-telegram-bot-api';
import { promises as fs, existsSync } from 'fs';
import puppeteer from 'puppeteer-core';
import { translate } from '@vitalets/google-translate-api';

function wordWrap(text: string, maxWidth: number): string {
    const words = text.split(' ');
    let wrappedText = '';
    let currentLine = '';

    words.forEach(word => {
        if ((currentLine + word).length < maxWidth) {
            currentLine += (currentLine.length > 0 ? ' ' : '') + word;
        } else {
            if (currentLine.length > 0) {
                wrappedText += currentLine + '\n';
            }
            currentLine = word;
        }
    });

    if (currentLine.length > 0) {
        wrappedText += currentLine;
    }

    return wrappedText;
}

function splitMessage(message: string, maxLength: number): string[] {
    if (message.length <= maxLength) return [message];

    const parts = [];
    let currentPart = '';

    message.split(/\s+/).forEach(word => {
        if ((currentPart + word).length <= maxLength) {
            currentPart += `${word} `;
        } else {
            parts.push(currentPart.trim());
            currentPart = `${word} `;
        }
    });

    if (currentPart.length > 0) {
        parts.push(currentPart.trim());
    }

    return parts;
}

async function fetchAndSavePage(url: string, filePath: string): Promise<string> {
    const dev = process.env.AZURE_FUNCTIONS_ENVIRONMENT === 'Development';
    if (dev && existsSync(filePath)) {
        return fs.readFile(filePath, 'utf8');
    } else {
        const browser = await puppeteer.launch({
            headless: true,
            executablePath: './cache/puppeteer/chrome-headless-shell-win32/chrome-headless-shell.exe',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-extensions']
        });
        const page = await browser.newPage();

        await page.goto(url, { waitUntil: 'networkidle2' });

        const data = await page.content();
        if (dev)
            await fs.writeFile(filePath, data, 'utf8');
        browser.close();
        return data;
    }
}
const bot = new TelegramBot(process.env.TELEGRAM_BOT_KEY!, { polling: false });
const REPORT_CHAT_ID = '44284808';

async function scrapeAndSend(url: string, selector: string, chatId: string, filePath: string = 'page.html') {
    try {
        const data = await fetchAndSavePage(url, filePath);
        const $ = cheerio.load(data);
        const text = wordWrap($(selector).text().replace(/(\s*\n\s*)+/g, '\n').replace(/ {2,}/g, ' ').trim(), 64);
        const { text: translatedText } = await translate(text, { to: 'ru' });
        if (process.env.AZURE_FUNCTIONS_ENVIRONMENT === 'Development')
            await fs.writeFile('snapshot.txt', translatedText, 'utf8');
        await bot.sendMessage(chatId, "Приветствую, новый отчёт за " + new Date().toLocaleDateString());
        const parts = splitMessage(translatedText, 4096);
        for (const part of parts) {
            await bot.sendMessage(chatId, part);
        }
    } catch (error) {
        await bot.sendMessage(REPORT_CHAT_ID, "Error: " + error);
        throw error;
    }
}

const URL = 'https://www.briefing.com/stock-market-update';
const SELECTOR = 'div#Content';
const CHAT_ID = process.env.AZURE_FUNCTIONS_ENVIRONMENT === 'Development' ? REPORT_CHAT_ID : '346672381';

export async function trigger(to_reporter: boolean = false): Promise<void> {
    await scrapeAndSend(URL, SELECTOR, to_reporter ? REPORT_CHAT_ID : CHAT_ID);
}