import { NodeHtmlMarkdown } from 'node-html-markdown'
import { Command } from "./command"
import * as fs from 'fs';
import * as cheerio from "cheerio";
import path from "path"
import winston from 'winston';
let notValidLink: Set<string> = new Set<string>()

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(winston.format.json()),
    transports: [
        new winston.transports.Console({ format: winston.format.colorize({ all: true }) }),
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
    ],
});

export class HTMLCommandToMarkdown {
    private $: cheerio.Root;
    public _command: Command;
    private _rootFolder: string;
    public commandType: string = "commands-legacy";
    public assetFolder: string = "commands";

    private constructor(inFile: string, inFileData: Buffer, inRootFolder: string) {
        this.$ = cheerio.load(inFileData);
        this._command = new Command(inFile)
        this._rootFolder = inRootFolder;
        const isWP = inFileData.includes("100-6993921") && this._command.getCommandID().startsWith("wp")
        this.commandType = isWP ? "WP" : "commands-legacy";
        this.assetFolder = isWP ? "WP" : "commands";
    }

    static FromFile(inFile: string, inRootFolder: string): HTMLCommandToMarkdown {
        return new HTMLCommandToMarkdown(inFile, fs.readFileSync(inFile), inRootFolder)
    }

    static FromFileData(inFile: string, inFileData: Buffer, inRootFolder: string): HTMLCommandToMarkdown {
        return new HTMLCommandToMarkdown(inFile, inFileData, inRootFolder)
    }

    static isLinkACommandFromLanguage(file: Buffer, inFile: string): boolean {
        if (inFile.includes("301-")) {
            let s = file.toString()
            return (s.includes("100-6957482") /*language*/
                || s.includes("100-6993921")/*write pro*/) && s.includes("ak_700.png") && !s.includes("ak_610.png")
        }
        return false;
    }

    static isLinkACommand(inFile: string): boolean {
        if (inFile.includes("301-")) {
            return true;
        }
        return false;
    }

    static isDeprecated(file: string): boolean {
        return path.parse(file).name.startsWith("o-")
    }

    getTheme(): string {
        return this.$(".ppB").last().text().trim()
    }

    _jsonToMarkdownTable(data: any[][]): string {
        let markdownTable = '';

        // Extract headers
        const headers = data[0];
        markdownTable += '| ' + headers.join(' | ') + ' |\n';
        markdownTable += '| ' + headers.map(() => '---').join(' | ') + ' |\n';

        // Extract rows
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            markdownTable += '| ' + row.join(' | ') + ' |\n';
        }

        return markdownTable;
    }

    async _convertParamsArray(): Promise<string> {
        let $args = this.$(".tSynt_table");
        let syntax = $args.find(".tSynt_td_cc").text().trim();
        syntax = syntax.replace(/^([\p{L}\s\d_]+)(?=\b\s*\(|\b\s*-|$|\b\s*\{)/u, "**$1**")
        syntax = syntax.replace(/(?<=;\s*\b|\(\s*\b|\)\s*\b|\{\s*\b|\}\s*\b)([\p{L}\d]+)(?=\s*;|\s*\)|\s*\{|\s*\})/gu, "*$1*")

        let tr = $args.find("tr");

        let formatedArgs = [];
        for (let i = 3; i < tr.length; i++) {
            let valid = false;
            let a: string[] = [];
            for await (const element of this.$(tr.get(i)).children()) {
                let e = this.$(element)
                let text = e.text().trim()
                if (text.length == 0) {
                    let image = e.find("img").attr("src");
                    if (image) {
                        valid = true;
                        if (image.endsWith("in_out1.png")) {
                            a.push("&rarr;");
                        }
                        else if (image.endsWith("in_out0.png")) {
                            a.push("&larr;");
                        }
                        else if (image.endsWith("in_out2.png")) {
                            a.push("&harr;");
                        }
                    }
                    continue;
                }
                valid = true;
                text = text.replace(/\|/g, "&#124;")
                text = text.replace(/(\r\n|\r|\n)/g, "<br/>")

                a.push(text);
            };
            if (valid)
                formatedArgs.push(a);
        }
        if (formatedArgs.length == 0)
            return ""
        formatedArgs[0].splice(2, 0, "");
        syntax = `<!--REF #_command_.${this._command.getCommandName()}.Syntax-->` + syntax + "<!-- END REF-->"
        const array = `<!--REF #_command_.${this._command.getCommandName()}.Params-->\n` + this._jsonToMarkdownTable(formatedArgs) + "\n<!-- END REF-->"
        return syntax + "\n" + array + "\n"
    }

    async _convertDescription(inDestFolder: string): Promise<string> {
        let $args = this.$(".command_paragraph");
        if ($args.length == 0) {
            $args = this.$("body")
        }
        await this._convertLinks($args)
        await this._convertPictures(inDestFolder, $args)
        let firstDescription = $args.find(".rte4d").first();
        if (firstDescription.length > 0) {
            firstDescription.prepend("__DESC__")
        }
        else {
            logger.error({ file: this._command, message: "No Description found" })
        }

        for await (const el of $args.find(".rte4d_prm")) {
            this.$(el).replaceWith("<i>" + this.$(el).html() + "</i>")
        }

        for await (const el of $args.find("pre")) {
            let currentLanguage = this.$(el).parent().attr("class");
            currentLanguage = currentLanguage?.split("code")[1]
            let content = this.$(el).html();
            this.$(el).parent().replaceWith(`<pre><code class="language-${currentLanguage}">` + content as string + "</pre></code>")
        }
        for await (const el of $args.find("code")) {
            let currentLanguage = this.$(el).parent().attr("class");
            if (!currentLanguage || currentLanguage?.startsWith("language-"))
                continue;
            currentLanguage = currentLanguage?.split("code")[1]
            let content = this.$(el).text();
            this.$(el).replaceWith(`<pre><code class="language-${currentLanguage}">` + content as string + "</pre></code>")
        }

        for await (const el of $args.find("tr").find("br")) {
            this.$(el).replaceWith("__SPACE__")
        }

        let markdown = NodeHtmlMarkdown.translate($args.html() as string, { emDelimiter: "*" })
        markdown = markdown.replace(/\\_\\_SPACE\\_\\_/g, "<br/>")
        markdown = markdown.replace(/\\_\\_SPACE\\_\\_/g, "<br/>")
        markdown = markdown.replace(/\\_\\_DESC\\_\\_\s+(.*?[\.。])(?!md)/, `<!--REF #_command_.${this._command.getCommandName()}.Summary-->$1<!-- END REF-->`)
        markdown = markdown.replace(/\\_\\_DESC\\_\\_/, "")
        markdown = this._convertOld4DCode(markdown)

        return markdown
    }

    _convertC_Command(code4D: string): string {
        if (this._command.isC_Command())
            return code4D;
        let regexConvertOldCommands = /(C_\w*)\((.*)\)/g;
        let newContent
        while ((newContent = regexConvertOldCommands.exec(code4D)) !== null) {
            let newType = ""
            if (newContent[1] == "C_OBJECT") {
                newType = "Object"
            }
            else if (newContent[1] == "C_LONGINT") {
                newType = "Integer"
            }
            else if (newContent[1] == "C_REAL") {
                newType = "Real"
            }
            else if (newContent[1] == "C_VARIANT") {
                newType = "Variant"
            }
            else if (newContent[1] == "C_TEXT") {
                newType = "Text"
            }
            else if (newContent[1] == "C_BOOLEAN") {
                newType = "Boolean"
            }
            else if (newContent[1] == "C_POINTER") {
                newType = "Pointer"
            }
            else if (newContent[1] == "C_PICTURE") {
                newType = "Picture"
            }
            else if (newContent[1] == "C_BLOB") {
                newType = "Blob"
            }
            else if (newContent[1] == "C_DATE") {
                newType = "Date"
            }
            else if (newContent[1] == "C_TIME") {
                newType = "Time"
            }
            else if (newContent[1] == "C_COLLECTION") {
                newType = "Collection"
            }
            else if (newContent[1] == "C_STRING") {
                logger.error({ message: `Cannot convert old 4D Code: ${newContent[1]}`, file: this._command })
            }
            else {
                logger.error({ message: `Cannot convert old 4D Code: ${newContent[1]}`, file: this._command })
            }
            if (newType != "")
                code4D = code4D.replace(newContent[0], `var ${newContent[2]} : ${newType}`)
        }
        return code4D;
    }

    _convertOldComments(code4D: string): string {
        let regexConvertOldComments = /`(.+)/gu
        let newContent
        while ((newContent = regexConvertOldComments.exec(code4D)) !== null) {
            code4D = code4D.replace(newContent[0], `//${newContent[1]}`)
        }
        return code4D;
    }

    _convertOld4DCode(markdown: string): string {
        let regexCode4D = /(?<=```4d\s)(\s+[\s\S]*?)(?=\s```)/gmu
        let result: RegExpExecArray | null;
        while ((result = regexCode4D.exec(markdown)) !== null) {
            const before = markdown.substring(0, result.index)
            const after = markdown.substring(result.index + result[0].length)
            let code4D = result[0]
            code4D = this._convertC_Command(code4D)
            code4D = this._convertOldComments(code4D)
            markdown = before + code4D + after
        }
        return markdown;
    }


    _createHeader() {
        return "---\n" +
            "id: " + this._command.getCommandID_Header() + "\n" +
            "title: " + this._command.getCommandName_Header() + "\n" +
            `slug: /${this.commandType}/${this._command.getCommandID()}` + "\n" +
            "displayed_sidebar: docs\n" +
            "---\n"
    }

    async _convertPictures(inDestFolder: string, $args: cheerio.Cheerio) {

        for await (const el of $args.find("img")) {
            let imagePath = this.$(el).attr("src");
            if (imagePath && this._command.language) {
                let parsedImagePath = path.parse(imagePath)
                let name = parsedImagePath.name + parsedImagePath.ext
                this.$(el).attr("src", "../assets/en/" + this.assetFolder + "/" + name)
                const dest = path.join(inDestFolder, this._command.language, "assets", "en", this.assetFolder);
                if (!fs.existsSync(dest))
                    fs.mkdirSync(dest, { recursive: true })
                try {
                    fs.copyFileSync(path.join(this._rootFolder, imagePath), path.join(dest, name))
                } catch (e) {
                    logger.error({ file: this._command, message: `Image not found: ${imagePath}` })
                }
            }
        }
    }

    async _convertLinks($args: cheerio.Cheerio) {
        const $links = $args.find("a")
        for (const el of $links) {
            let link = this.$(el).attr("href");
            const aClass = this.$(el).attr("class");
            const is4DCode = aClass?.startsWith("code4d")
            if (link && link.includes(".html") && !is4DCode) {
                try {
                    let commandLocation;
                    if (link.startsWith("/")) {
                        commandLocation = "." + link
                    }
                    else {
                        commandLocation = path.join(this._rootFolder, link)
                    }
                    if (notValidLink.has(link)) {
                        logger.error({ message: `Cannot convert link: ${link}`, file: this._command })
                        this.$(el).replaceWith(`<em>${this.$(el).text()}</em>`);
                        continue;
                    }
                    if (HTMLCommandToMarkdown.isLinkACommand(commandLocation)) {
                        const data = fs.readFileSync(commandLocation)
                        if (HTMLCommandToMarkdown.isLinkACommandFromLanguage(data, commandLocation) && !HTMLCommandToMarkdown.isDeprecated(commandLocation)) {
                            const dest = new Command(link).getCommandID() + ".md";
                            this.$(el).attr("href", dest);
                        }
                        else {
                            notValidLink.add(link);
                            this.$(el).replaceWith(`<em>${this.$(el).text()}</em>`);
                            logger.error({ message: `Cannot convert link: ${link}`, file: this._command })
                        }
                    }
                    else {
                        notValidLink.add(link);
                        this.$(el).replaceWith(`<em>${this.$(el).text()}</em>`);
                        logger.error({ message: `Cannot convert link: ${link}`, file: this._command })
                    }

                } catch (e) {
                    notValidLink.add(link);
                    this.$(el).replaceWith(`<em>${this.$(el).text()}</em>`);
                    logger.error({ message: `Cannot convert link: ${link}`, file: this._command })
                }
            }
        }
    }

    async _convertSeeAlso(): Promise<string> {
        let $args = this.$("#SeeAlso_title");
        await this._convertLinks($args.next())
        let markdown = "";
        if ($args.length > 0) {
            markdown = "\n####" + NodeHtmlMarkdown.translate($args.html() as string) + "\n\n"
            markdown += NodeHtmlMarkdown.translate($args.next().html() as string, { emDelimiter: "*" })
        }

        return markdown;
    }

    async run(inDestFolder: string) {
        logger.info({ file: this._command })
        //console.log({ file: this._command })
        let list = []
        list.push(this._createHeader())
        list.push(await this._convertParamsArray());
        list.push(await this._convertDescription(inDestFolder));
        list.push(await this._convertSeeAlso());

        return list.join("\n");
    }
}
