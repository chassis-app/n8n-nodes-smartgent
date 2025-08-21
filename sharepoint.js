const axios = require('axios');
const qs = require('qs');
const fs = require('fs');
const converter = require('json-2-csv');
const dotenv = require('dotenv');
const e = require('express');
dotenv.config();

const getsiteid = async (siteurl, token) => {
	try {
		let paths = siteurl.split("sites/")
		let sitename = paths[1].split("/")[0]

		const options = {
			method: 'GET',
			headers: { 'Authorization': 'Bearer ' + token },
			url: "https://graph.microsoft.com/v1.0/sites?search=" + sitename
		}

		const res = (await axios(options)).data
		let id_index = res.value.findIndex((x) => {
			return x.name == sitename
		})

		return res.value[id_index].id
	} catch (e) {
		console.error("error");
		console.error(siteurl);
		console.error(e);
	}
}

const getlistid = async (siteurl, token, siteid) => {
	const pattern = /sites\/[^\/]+\/([^\/]+)/;
	const match = siteurl.match(pattern);
	let basicDriveName = ""
	if (match && match[1]) {
		basicDriveName = match[1];
	}
	let weburl_ = siteurl.split(basicDriveName)[0] + basicDriveName
	console.log(basicDriveName)

	const options = {
		method: 'GET',
		headers: { 'Authorization': 'Bearer ' + token },
		url: "https://graph.microsoft.com/v1.0/sites/" + siteid + "/lists"
	}
	const res = (await axios(options)).data
	let id_index = res.value.findIndex((x) => {
		return x.webUrl == weburl_
	})

	return res.value[id_index].id
}

const getdriveid = async (siteurl, token, siteid) => {
	const options = {
		method: 'GET',
		headers: { 'Authorization': 'Bearer ' + token },
		url: "https://graph.microsoft.com/v1.0/sites/" + siteid + "/drives"
	}
	const res = (await axios(options)).data
	let id_index = res.value.findIndex((x) => {
		return siteurl.toLowerCase().startsWith(x.webUrl.toLowerCase());
	})
	return res.value[id_index].id
}

const getfolder_id = async (siteurl, token, driveid) => {
	const pattern = /sites\/[^\/]+\/([^\/]+)/;
	const match = siteurl.match(pattern);
	let basicDriveName = ""
	if (match && match[1]) {
		basicDriveName = match[1];
	}
	let path = siteurl.split(basicDriveName)[1];
	let options;
	if (path.length === 0) {
		options = {
			method: 'GET',
			headers: { 'Authorization': 'Bearer ' + token },
			url: "https://graph.microsoft.com/v1.0/drives/" + driveid + "/root"
		}
	} else {
		options = {
			method: 'GET',
			headers: { 'Authorization': 'Bearer ' + token },
			url: "https://graph.microsoft.com/v1.0/drives/" + driveid + "/root:/" + path
		}
	}
	const res = (await axios(options)).data.id

	return res
}

const getallfile = async (siteurl, token, driveid) => {

	const pattern = /sites\/[^\/]+\/([^\/]+)/;
	const match = siteurl.match(pattern);
	let basicDriveName = ""
	if (match && match[1]) {
		// Decode URI component to convert "%20" to spaces, etc.
		basicDriveName = match[1];
	}
	let path = siteurl.split(basicDriveName)[1]
	const options = {
		method: 'GET',
		headers: { 'Authorization': 'Bearer ' + token },
		url: "https://graph.microsoft.com/v1.0/drives/" + driveid + "/root:/" + path + ":/children"
	}
	const res = (await axios(options)).data
	let result = []
	for (let i of res.value) {
		if (i.file != undefined) {
			result.push({
				id: i.id,
				name: i.name
			})
		}
	}
	console.log(result)
	return result
}
const getallfileByFolderId = async (folderID, drive_id, token) => {
	let files_id = []
	let url = "https://graph.microsoft.com/v1.0/drives/" + drive_id + "/items/" + folderID + "/children";
	do {
		const options = {
			method: 'GET',
			headers: { 'Authorization': 'Bearer ' + token },
			url
		}
		const res = (await axios(options)).data;
		console.log(res);
		files_id = files_id.concat(res.value
			.filter(i => i.file !== undefined)
			.map(i => ({
				mic_id: i.id,
				name: i.name,
				downloadlink: i["@microsoft.graph.downloadUrl"],
				last_update: i.lastModifiedDateTime
			}))
		);
		url = res["@odata.nextLink"];
	} while (url !== undefined);
	console.log(files_id);
	return files_id;
}

const getallfileByListId = async (siteId, listId, folder_path, token) => {
	let files_id = [];
	let url = "https://graph.microsoft.com/v1.0/sites/" + siteId + "/lists/" + listId + "/items";
	do {
		const options = {
			method: 'GET',
			headers: { 'Authorization': 'Bearer ' + token },
			url
		}
		const res = (await axios(options)).data;
		files_id = files_id.concat(res.value
			.filter(i => i.webUrl === folder_path)
			.map(i => ({
				mic_id: i.id,
				name: i.name,
				downloadlink: i["@microsoft.graph.downloadUrl"],
				last_update: i.lastModifiedDateTime
			}))
		);
		url = res["@odata.nextLink"];
	} while (url !== undefined);
	return files_id
}

const getfileByListId = async (siteId, listId, fileId, token) => {
	let url = "https://graph.microsoft.com/v1.0/sites/" + siteId + "/lists/" + listId + "/items/" + fileId;
	const options = {
		method: 'GET',
		headers: { 'Authorization': 'Bearer ' + token },
		url
	}
	const res = (await axios(options)).data
	return {
		mic_id: res.value.id,
		name: res.value.name,
		downloadlink: i["@microsoft.graph.downloadUrl"],
		last_update: res.value.lastModifiedDateTime
	}
}

const movefile = async (drive_id, file_id, dict_folder_id, token) => {
	let url_ = "https://graph.microsoft.com/v1.0/drives/" + drive_id + "/items/" + file_id + "?@microsoft.graph.conflictBehavior=rename"
	let body = {
		"parentReference": {
			"id": dict_folder_id
		},
		"@microsoft.graph.conflictBehavior": "rename"
	}
	const options = {
		method: 'PATCH',
		headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
		data: JSON.stringify(body),
		url: url_
	}
	const res = await axios(options);
	return res
}

const tagfile = async (file_id, site_id,listId, token,tags) => {
	try{
		console.log("file_id",file_id)
		console.log("site_id",site_id)
		console.log("listId",listId)
		let url_getID = "https://graph.microsoft.com/v1.0/sites/"+site_id+"/lists/"+listId+"/items?$select=driveItem&$expand=driveItem"
		
		const options1 = {
			method: 'get',
			headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
			url: url_getID
		}
		const res1 = await axios(options1);
		const item1 = res1.data.value.filter(item=> {return item.driveItem.id == file_id})

		let url_ = "https://graph.microsoft.com/v1.0/sites/"+site_id+"/lists/"+listId+"/items/"+item1[0].id
		console.log(tags)
		tags = tags.replace(/'/g, '"');
		console.log(typeof(tags))
		let json = JSON.parse(tags)
		console.log(json.tag.department)
		console.log(json.tag.have_sensitivity_information)
		const tagMetadata = {
			"fields" : {
					"Tag": json.tag.department,
					"JSON": tags,
					"Department": json.tag.department,
					"Sensitivity_info": json.tag.have_sensitivity_information,
			}
			
			
		};
		const options = {
			method: 'PATCH',
			headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
			data: JSON.stringify(tagMetadata),
			url: url_
		}
		//const options = {
		//	method: 'GET',
		//	headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
		//	//data: JSON.stringify(tagMetadata),
		//	url: url_
		//}
		const res = await axios(options);
		//console.log("ok",res.data)
		return res
	}catch(e){
		console.log(e);
	}
}

const getFileContentByFileId = async (siteId, driveId, fileId, token) => {
	const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/items/${fileId}/content`
	const options = {
		method: 'GET',
		headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/octet-stream' },
		responseType: 'stream',
		url: url
	}
	const res = await axios(options);
	return res.data;
}

const downloadFile = async (siteId, driveId, fileId, filename, token) => {
	const folderPath = `/fileStore/app/${driveId.replace("!", "")}`;
	const path = `${folderPath}/${filename}`;

	const resdata = getFileContent(siteId, driveId, fileId, token);

	try {
		try { fs.rm(`.${path}`) } finally { }
		resdata.pipe(fs.createWriteStream(`.${path}`));
	} catch (e) {
		console.log("fs error")
		console.log(e);
		await fs.writeFile(`.${path}`, resdata);
	}
	return path;
}

const getFileContentByUrl = async (url, token) => {
	const options = {
		method: 'GET',
		responseType: 'stream',
		url: url
	}
	const res = await axios(options);
	console.log(res.data);
	return res.data;
}

const getSiteRelativePathByUrl = async (siteUrl) => {
	let match = siteUrl.match(/^https:\/\/[^.]+.sharepoint.com\/(sites|teams)\/([^\/]+)/);
	if (match && match[2]) {
		return `/${match[1]}/${match[2]}`;
	}
	match = siteUrl.match(/^https:\/\/[^.]+.sharepoint.com\/([^\/]+)/);
	if (match && match[1]) {
		return `/${match[1]}`;
	}
	throw new Error("Incorrect SharePoint site format");
}

const uploadResult = async (results, folderUrl, token) => {
	const csv = converter.json2csv(results);
	const csvBuffer = Buffer.from(csv);
	const siteid = await getsiteid(folderUrl, token);
	const driveid = await getdriveid(folderUrl, token, siteid);
	const folderid = await getfolder_id(folderUrl, token, driveid);
	let filename = `${new Date().toISOString().replace(/(-|T|:|\.|Z)/g, "")}_results.csv`;
	if (csvBuffer.length < 250 * 1024 * 1024) {
		console.log("CSV Result file size < 250MB");
		console.log(csv);
		let url = "https://graph.microsoft.com/v1.0/drives/" + driveid + "/items/" + folderid + ":/" + filename + ":/content";
		let options = {
			method: 'PUT',
			headers: {
				'Authorization': 'Bearer ' + token,
				'Content-Type': "text/plain"
			},
			data: csvBuffer,
			url
		}
		let res = await axios(options);
		return res
	} else {
		console.log("CSV Result file size >= 250MB");
		let url = "https://graph.microsoft.com/v1.0/drives/" + driveid + "/items/" + folderid + ":/" + filename + ":/createUploadSession";
		let options = {
			method: 'POST',
			headers: {
				'Authorization': 'Bearer ' + token,
				'Content-Type': "application/json",
				"name": filename,
				"fileSize": csv.length
			},
			body: JSON.stringify({
				"@microsoft.graph.conflictBehavior": "replace"
			}),
			url
		}
		let res = await axios(options);
		console.log("CSV length: " + csvBuffer.length);
		url = res.data.uploadUrl;
		let segSize = 327680;
		for(let i = 0; i < csvBuffer.length; i += segSize) {
			options = {
				method: 'PUT',
				headers: {
					'Authorization': 'Bearer ' + token,
					'Content-Type': "text/plain",
					'Content-Range': `bytes ${i}-${Math.min(i + segSize, csvBuffer.length)}/${csvBuffer.length}`
				},
				data: csvBuffer.subarray(i, Math.min(i + segSize, csvBuffer.length)),
				url
			}
			res = await axios(options);
		}
		return res
	}
}

module.exports = {
	getsiteid,
	getdriveid,
	getlistid,
	getallfile,
	getfolder_id,
	getallfileByFolderId,
	getfileByListId,
	movefile,
	getFileContentByFileId,
	downloadFile,
	getallfileByListId,
	getSiteRelativePathByUrl,
	getFileContentByUrl,
	uploadResult,
	tagfile
}
