import { NodeHtmlMarkdown } from 'node-html-markdown'
import { Command } from "./command"
import * as fs from 'fs';
import * as cheerio from "cheerio";
import path from "path"
import winston from 'winston';
import { HTMLIdentifier } from './HTMLIdentifier';
let notValidLink: Set<string> = new Set<string>()

export interface HTMLToMD {
    id : string;
    data : string;
}

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(winston.format.json()),
    transports: [
        new winston.transports.Console({ format: winston.format.colorize({ all: true }) }),
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
    ],
});

export class HTMLToMarkdown {
    private $: cheerio.Root;
    private _rootFolder: string;
    public commandType: string = "commands-legacy";
    public assetFolder: string = "commands";
    public assetFolderLocation : string = "../assets/en/"
    public _title: string = "";
    private _file : string = ""

    private constructor(inFile: string, inFileData: Buffer, inRootFolder: string) {
        this.$ = cheerio.load(inFileData);
        this._rootFolder = inRootFolder;
        this._file = inFile;
        this._title = new Command(inFile).getCommandID();
    }

    static FromFile(inFile: string, inRootFolder: string): HTMLToMarkdown {
        return new HTMLToMarkdown(inFile, fs.readFileSync(inFile), inRootFolder)
    }


    async _convertDescription(inDestFolder: string): Promise<string> {
        let $args = this.$(".title_paragraph");
        if ($args.length == 0) {
            $args = this.$("body")
        }
        await this._convertLinks($args)
        await this._convertPictures(inDestFolder, $args)
        
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

        for await (const el of $args.find("table table")) {
            for await (const thead of this.$(el).find("thead")) {
                this.$(thead).replaceWith(`__THEAD__${this.$(thead).html()}__ETHEAD__`)
            }
            for await (const tbody of this.$(el).find("tbody")) {
                this.$(tbody).replaceWith(`__TBODY__${this.$(tbody).html()}__ETBODY__`)
            }
            for await (const tr of this.$(el).find("tr")) {
                this.$(tr).replaceWith(`__TR__${this.$(tr).html()}__ETR__`)
            }
            for await (const td of this.$(el).find("td")) {
                this.$(td).replaceWith(`__TD__${this.$(td).html()}__ETD__`)
            }
            this.$(el).replaceWith(`__TABLE__${this.$(el).html()}__ETABLE__`)
        }

        for await (const el of $args.find("table ul")) {
            for await (const td of this.$(el).find("li")) {
                this.$(td).replaceWith(`__LI__${this.$(td).html()}__ELI__`)
            }
            this.$(el).replaceWith(`__UL__${this.$(el).html()}__EUL__`)
        }

        let markdown = NodeHtmlMarkdown.translate($args.html() as string, { emDelimiter: "*" })
        markdown = markdown.replace(/\\_\\_SPACE\\_\\_/g, "<br/>")
        markdown = markdown.replace(/\\_\\_SPACE\\_\\_/g, "<br/>")

        markdown = markdown.replace(/\\_\\_TABLE\\_\\_/g, "<table>")
        markdown = markdown.replace(/\\_\\_ETABLE\\_\\_/g, "</table>")
        markdown = markdown.replace(/\\_\\_THEAD\\_\\_/g, "<thead>")
        markdown = markdown.replace(/\\_\\_ETHEAD\\_\\_/g, "</thead>")
        markdown = markdown.replace(/\\_\\_TBODY\\_\\_/g, "<tbody>")
        markdown = markdown.replace(/\\_\\_ETBODY\\_\\_/g, "</tbody>")
        markdown = markdown.replace(/\\_\\_TR\\_\\_/g, "<tr>")
        markdown = markdown.replace(/\\_\\_ETR\\_\\_/g, "</tr>")
        markdown = markdown.replace(/\\_\\_TD\\_\\_/g, "<td>")
        markdown = markdown.replace(/\\_\\_ETD\\_\\_/g, "</td>")
        markdown = markdown.replace(/\\_\\_UL\\_\\_/g, "<ul>")
        markdown = markdown.replace(/\\_\\_EUL\\_\\_/g, "</ul>")
        markdown = markdown.replace(/\\_\\_LI\\_\\_/g, "<li>")
        markdown = markdown.replace(/\\_\\_ELI\\_\\_/g, "</li>")

        markdown = this._convertOld4DCode(markdown)

        return markdown
    }

    _convertC_Command(code4D: string): string {

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
                logger.error({ message: `Cannot convert old 4D Code: ${newContent[1]}`, file: this._title })
            }
            else {
                logger.error({ message: `Cannot convert old 4D Code: ${newContent[1]}`, file: this._title })
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
            "id: " + this._title + "\n" +
            "title: " + this._title + "\n" +
            "---\n"
    }

    async _convertPictures(inDestFolder: string, $args: cheerio.Cheerio) {

        for await (const el of $args.find("img")) {
            let imagePath = this.$(el).attr("src");
            //TODO!
            if (imagePath) {
                let parsedImagePath = path.parse(imagePath)
                let name = parsedImagePath.name + parsedImagePath.ext
                this.$(el).attr("src", this.assetFolderLocation + name)
                const dest = path.join(inDestFolder, "assets", "en");
                if (!fs.existsSync(dest))
                    fs.mkdirSync(dest, { recursive: true })
                try {
                    fs.copyFileSync(path.join(this._rootFolder, imagePath), path.join(dest, name))
                } catch (e) {
                    logger.error({ file: this._title, message: `Image not found: ${imagePath}` })
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
                    
                    if(HTMLIdentifier.isLinkACommand(commandLocation) && !HTMLIdentifier.isCommandDeprecated(commandLocation))
                    {
                        const command = new Command(commandLocation);
                        const prefix = command.getCommandID().startsWith("wp") ? "WritePro/commands" : "commands";
                        this.$(el).attr("href", `${prefix + "/" +command.getCommandID() + ".md"}`);
                    }
                    else
                    {
                        this.$(el).replaceWith(`<em>${this.$(el).text()}</em>`);
                    }
                } catch (e) {
                    notValidLink.add(link);
                    this.$(el).replaceWith(`<em>${this.$(el).text()}</em>`);
                    logger.error({ message: `Cannot convert link: ${link}`, file: this._title })
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

    async run(inDestFolder: string) : Promise<HTMLToMD>{
        logger.info({ file: this._title })
        //console.log({ file: this._command })
        let list = []
        list.push(this._createHeader())
        list.push(await this._convertDescription(inDestFolder));
        list.push(await this._convertSeeAlso());

        return {id:this._title, data:list.join("\n")};
    }
}
