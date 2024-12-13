/*
image/prop/ok.xx.png	OK AddSettings	2	The OK variable is changed by the command
    /image/prop/setting.xx.png	Stub AddSettings	3	When applied to an object of the current class, this method will always return the same value
    /image/prop/leaks.xx.png	Memory leaks AddSettings	4	Can provoke memory leaks if the code does not delete references after use
    /image/prop/document.xx.png	Document AddSettings	5	This command modifies the system Document variable
    /image/prop/lockedset.xx.png	LockedSet AddSettings	6	This command modifies the LockedSet system set
    /image/prop/userset.xx.png	UserSet AddSettings	7	This command modifies the UsertSer system set
    /image/prop/error.xx.png	Error AddSettings	8	This command modifies the Error system variable
    /image/prop/currentrecord.xx.png	Current record AddSettings	10	This command changes the currrent record
    /image/prop/currentsel.xx.png	Current selection AddSettings	11	The command changes the current selection
    /image/prop/preemption.xx.png	Preemptive AddSettings	13	This command can be run in preemptive processes
    /image/prop/unicode.xx.png	Unicode AddSettings	20	The Unicode mode affects this command
    /image/prop/remotedifferent.xx.png	Remote different AddSettings	40	Different in remote mode
    /image/prop/notcs.xx.png	Not for server AddSettings	41	Not for server
    /image/prop/trigger.xx.png	Not for trigger AddSettings	44	Cannot be used in triggers
    /image/prop/mac.xx.png	Mac OS AddSettings	50	This command has platform-specific behavior
    /image/prop/windows.xx.png	Windows AddSettings	51	This command has platform-specific behavior
    /image/prop/32bits.xx.png	Not for 32-bit versions AddSettings	52	Feature(s) not available in 4D 32 bits
    /image/prop/setting.xx.png	Setting AddSettings	100	Database parameters affect this command
    /image/prop/network.xx.png	Network AddSettings	110	Commande provoquant un échange entre le client et le serveur
    /image/prop/expe.xx.png	experimental AddSettings	200	This API is experimental and should not be used in production


*/

use regex::Regex;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, fs};

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Translation {
    command_number: String,
    thread_safe: String,
    modifies_variables: String,
    changes_current_record: String,
    changes_current_selection: String,
    forbidden_on_server: String,
    comma: String,
    properties: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Properties {
    command_id: usize,
    preemptive: bool,
    modify_ok: bool, // The OK variable is changed by the command
    // The command modifies the system Document variable
    modify_document: bool,
    // The command modifies the LockedSet system set
    modify_locked_set: bool,
    // The command modifies the UsertSer system set
    modify_user_set: bool,
    // The command modifies the Error system variable
    modify_error: bool,
    // The command changes the currrent record
    modify_record: bool,
    // The command changes the current selection
    modify_selection: bool,
    // The command is different in remote
    remote: bool,
    // The command is not for the server
    not_for_server: bool,
}

impl Properties {
    fn new() -> Self {
        Self {
            command_id: 0,
            preemptive: false,
            modify_ok: false,
            modify_document: false,
            modify_locked_set: false,
            modify_user_set: false,
            modify_error: false,
            modify_record: false,
            modify_selection: false,
            remote: false,
            not_for_server: false,
        }
    }

    fn from(content: &str) -> Option<Self> {
        let mut properties = Self::new();
        if let Ok(regex_command_number) = regex::Regex::new(r#"Number\s?:\s*(\d+)"#) {
            regex_command_number.captures(content).map(|cap| {
                properties.command_id = cap[1].parse().unwrap_or(0);
            });
        }
        properties.preemptive = content.contains("image/prop/preemption.xx.png");
        properties.modify_ok = content.contains("image/prop/ok.xx.png");
        properties.modify_document = content.contains("image/prop/document.xx.png");
        properties.modify_locked_set = content.contains("image/prop/lockedset.xx.png");
        properties.modify_user_set = content.contains("image/prop/userset.xx.png");
        properties.modify_error = content.contains("image/prop/error.xx.png");
        properties.modify_record = content.contains("image/prop/currentrecord.xx.png");
        properties.modify_selection = content.contains("image/prop/currentsel.xx.png");
        properties.remote = content.contains("image/prop/remotedifferent.xx.png");
        properties.not_for_server = content.contains("image/prop/notcs.xx.png");
        if properties.command_id == 0 {
            None
        } else {
            Some(properties)
        }
    }

    fn to_string(&self, translation: &Translation) -> String {
        let mut output = String::new();
        output.push_str("|  |  |\n");
        output.push_str("| --- | --- |\n");
        output.push_str(
            format!("| {} | {} |\n", translation.command_number, self.command_id).as_str(),
        );

        if self.preemptive {
            output.push_str(format!("| {} | {} |\n", translation.thread_safe, "&check;").as_str());
        } else {
            output.push_str(format!("| {} | {} |\n", translation.thread_safe, "&cross;").as_str());
        }

        let mut list_modified_variables = vec![];
        if self.modify_ok {
            list_modified_variables.push("OK");
        }
        if self.modify_document {
            list_modified_variables.push("Document");
        }
        if self.modify_error {
            list_modified_variables.push("error");
        }
        if !list_modified_variables.is_empty() {
            output.push_str(
                format!(
                    "| {} | {} |\n",
                    translation.modifies_variables,
                    list_modified_variables
                        .join(translation.comma.as_str())
                        .as_str()
                )
                .as_str(),
            );
        }

        if self.modify_record {
            output.push_str(format!("| {} ||\n", translation.changes_current_record).as_str());
        }

        if self.modify_selection {
            output.push_str(format!("| {} ||\n", translation.changes_current_selection).as_str());
        }

        if self.not_for_server {
            output.push_str(format!("| {} ||\n", translation.forbidden_on_server).as_str());
        }
        output
    }
}

fn is_command(in_content: &str) -> bool {
    in_content.contains("100-6957482") /*language*/
    || in_content.contains("100-6993921")/*write pro*/ 
    && in_content.contains("ak_700.png") 
    && !in_content.contains("ak_610.png")
}

/* Renamed commands
Get action info 	Action info
GET ACTIVITY SNAPSHOT 	ACTIVITY SNAPSHOT
Get application info 	Application info
GET BACKUP INFORMATION 	BACKUP INFO
Get call chain 	Call chain
Get database measures 	Database measures
Get last field number 	Last field number
Get last query path 	Last query path
Get last query plan 	Last query plan
Get last table number 	Last table number
Get license info 	License info
Get license usage 	License usage
Get localized document path 	Localized document path
Get localized string 	Localized string
Get locked records info 	Locked records info
GET MEMORY STATISTICS 	MEMORY STATISTICS
Get Monitored Activity 	Monitored activity
GET MOUSE 	MOUSE POSITION
GET RESTORE INFORMATION 	RESTORE INFO
Get system info 	System info
Get table fragmentation 	Table fragmentation
Session storage by id 	Session storage

*/

fn create_properties() -> Result<HashMap<String, Option<Properties>>, anyhow::Error> {
    let mut list_properties = HashMap::new();

    let renamed_command = HashMap::from([
        ("get-action-info", "action-info"),
        ("get-activity-snapshot", "activity-snapshot"),
        ("get-application-info", "application-info"),
        ("get-backup-information", "backup-info"),
        ("get-call-chain", "call-chain"),
        ("get-database-measures", "database-measures"),
        ("get-last-field-number", "last-field-number"),
        ("get-last-query-path", "last-query-path"),
        ("get-last-query-plan", "last-query-plan"),
        ("get-last-table-number", "last-table-number"),
        ("get-license-info", "license-info"),
        ("get-license-usage", "license-usage"),
        ("get-localized-document-path", "localized-document-path"),
        ("get-localized-string", "localized-string"),
        ("get-locked-records-info", "locked-records-info"),
        ("get-memory-statistics", "memory-statistics"),
        ("get-monitored-activity", "monitored-activity"),
        ("get-mouse", "mouse-position"),
        ("get-restore-information", "restore-info"),
        ("get-system-info", "system-info"),
        ("get-table-fragmentation", "table-fragmentation"),
        ("session-storage-by-id", "session-storage"),
    ]);
    for entry in glob::glob("../4Dv20R6/4D/20-R6/*.301-*")? {
        let entry = entry?;
        let content = std::fs::read_to_string(entry.as_path())?;
        if is_command(&content) {
            if let Some(file_name) = entry.as_path().file_stem() {
                let str = file_name.to_str().unwrap_or("");
                let mut command_name = str.split(".").next().unwrap_or("").to_lowercase();
                command_name = renamed_command
                    .get(command_name.as_str())
                    .map_or(command_name, |v| v.to_string());

                if str.ends_with("en") && !str.starts_with("o-") {
                    list_properties.insert(command_name, Properties::from(&content));
                }
            }
        }
    }
    Ok(list_properties)
}

fn remove_old_message(list: &Vec<&str>) -> Result<(), anyhow::Error> {
    let regex = Regex::new(r#"(Params-->[\S\s]*?<!--\s*END REF\s*-->)(\s*\*.*?\*\s)"#)?;
    for directory in list {
        for entry in glob::glob(directory)? {
            let entry = entry?;
            let path = entry.as_path();
            let mut content = fs::read_to_string(path)?;
            content = regex.replace(&content, "$1").to_string();
            fs::write(&path, content)?;
        }
    }

    Ok(())
}

fn build_property_to_display(
    language: &str,
    command_name: &str,
    list_translations: &HashMap<String, Translation>,
    list_properties: &HashMap<String, Option<Properties>>,
) -> Option<String> {
    let mut output = String::new();
    if let Some(properties) = list_properties
        .get(command_name)
        .and_then(|opt| opt.as_ref())
    {
        let translation = list_translations.get(language)?;
        let properties_str = properties.to_string(translation);
        output.push_str("\n\n");
        output.push_str(format!("#### {}\n\n", translation.properties).as_str());
        output.push_str(properties_str.as_str());
        output.push_str("\n\n");
    }

    Some(output)
}

fn add_prperties(
    list: &Vec<&str>,
    list_properties: &HashMap<String, Option<Properties>>,
    list_translations: &HashMap<String, Translation>,
) -> Result<(), anyhow::Error> {
    for directory in list {
        let mut language = "en".to_string();

        for entry in glob::glob(directory)? {
            let entry = entry?;
            let path = entry.as_path();
            let path_str = path.to_str().unwrap_or("").to_string();
            if let Some(ipos) = &path_str.find("i18n") {
                let lang = path_str[ipos + 5..ipos + 7].to_string();
                language = lang.clone();
            }
            let command_name = path
                .file_stem()
                .unwrap()
                .to_str()
                .unwrap()
                .split(".")
                .next()
                .unwrap()
                .to_lowercase();
            if let Some(to_display) = build_property_to_display(
                &language,
                &command_name,
                list_translations,
                list_properties,
            ) {
                //println!("{} {}", path_str, &language);
                let mut content = fs::read_to_string(path)?;
                content.push_str(to_display.as_str());
                fs::write(&path, content)?;
            }
        }
    }

    Ok(())
}

fn main() -> Result<(), anyhow::Error> {
    let list_to_apply = vec![
        "../../docs/docs/commands/**/*.md",
        "../../docs/docs/commands-legacy/**/*.md",
        "../../docs/i18n/*/docusaurus-plugin-content-docs/*/commands-legacy/**/*.md",
        "../../docs/versioned_docs/version-20-R7/commands-legacy/**/*.md",
        "../../docs/versioned_docs/version-20-R7/commands/**/*.md",
    ];
    let translation_map = {
        let content = fs::read_to_string("translations.json")?;
        serde_json::from_str::<HashMap<String, Translation>>(&content)?
    };
    let list_properties = create_properties()?;
    let output = serde_json::to_string_pretty(&list_properties)?;
    fs::write("properties.json", output)?;
    let list_properties: HashMap<String, Option<Properties>> =
        serde_json::from_str(std::fs::read_to_string("properties.json")?.as_str())?;

    remove_old_message(&list_to_apply)?;
    add_prperties(&list_to_apply, &list_properties, &translation_map)?;
    Ok(())
}
