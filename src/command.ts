import path from "path"


export class Command {
    public language: string;
    private name: string;

    constructor(link: string) {
        let fileName = path.parse(link).name;
        this.name = fileName
        this.language = "en"

        let splits = fileName.split(".");
        if (splits.length > 2) {
            this.name = splits[0].replace(/-/g, " ");
            this.language = splits[2];
        }
    }
    getCommandID(): string {
        const id = this.name.toLowerCase().replace(/\s+/g, "-")
        return id;
    }

    getCommandID_Header(): string {
        const id = this.getCommandID()

        if ((id === "false" || id === "true" || id === "null"))
            return `"${id}"`;
        return id;
    }

    isC_Command(): boolean {
        return this.name.startsWith("C ")
    }
    getCommandName(): string {
        if (this.isC_Command()) {
            return this.name.replace(/\s+/g, "_")
        }
        return this.name
    }

    getCommandName_Header(): string {
        const name = this.getCommandName()

        if ((name === "False" || name === "True" || name === "Null"))
            return `"${name}"`;
        return name;
    }

    toString(): string {
        return `{name:${this.name}, language:${this.language}}`
    }

}

