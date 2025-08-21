const dotenv = require('dotenv');
const axios = require('axios')
const qs = require('qs')

dotenv.config();

const getGraphAccessToken = async () => {
    const token_endpoint = process.env.SC_TOKEN_ENDPOINT
    const grant_type = 'client_credentials'
    const client_id = process.env.SC_CLIENT_ID
    const scope = 'https://graph.microsoft.com/.default'
    const client_secret = process.env.SC_CLIENT_SECRET

    const data = {
        grant_type: grant_type,
        client_id: client_id,
        scope: scope,
        client_secret: client_secret,
    }

    const options = {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        data: qs.stringify(data),
        url: token_endpoint
    }

    const token = await axios(options)
    return token.data.access_token
}
module.exports = {
    getGraphAccessToken
}