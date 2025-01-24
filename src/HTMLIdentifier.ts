import { Command } from "./command";

export class HTMLIdentifier {
    static GetCommandInfo(inFile: string, inFileData: Buffer): any {
        const isWP = inFileData.includes("100-6993921") && new Command(inFile).getCommandID().startsWith("wp")
        return {
            commandType: isWP ? "WritePro/commands-legacy" : "commands-legacy",
            assetFolder: isWP ? "WritePro/commands" : "commands",
            assetFolderLocation: isWP ? "../../assets/en/" : "../assets/en/",
            slug: isWP ? "WritePro/commands" : "commands"
        }
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


    static isCommandDeprecated(inFile: string): boolean {
        if (inFile.includes("/o-")) {
            return true;
        }
        return false;
    }
}