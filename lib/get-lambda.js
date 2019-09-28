const AWS = require('aws-sdk')

const initialize = () => {
  AWS.config.update({ region: process.env.REGION })
  return {
    docClient: new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' }),
    TableName: process.env.TABLE_NAME,
    primaryKeyColumn: process.env.PRIMARY_KEY_COLUMN_NAME,
    sortKeyColumn: process.env.SORT_KEY_COLUMN_NAME,
    region: process.env.REGION
  }
}

const isConfigInvalid = ({ docClient, TableName, primaryKeyColumn, sortKeyColumn, region }) => {
  if (!docClient || !TableName || !primaryKeyColumn || !sortKeyColumn || !region) {
    return true
  }
}

const getAuthToken = (headers) => {
  const authHeader = headers.Authorization || headers.authorization
  return authHeader.trim().replace('Bearer ', '')
}

const getOrigin = (headers) => {
  return headers.Origin || headers.origin || '*'
}

const doGet = (config) => {
  const params = {
    TableName: config.TableName,
    Key: {
      [config.primaryKeyColumn]: config.primaryKey,
      [config.sortKeyColumn]: config.sortKey
    }
  }
  return config.docClient.get(params).promise()
}

const doQuery = (config) => {
  const params = {
    TableName: config.TableName,
    ExpressionAttributeValues: {
      ':k': config.primaryKey
    },
    KeyConditionExpression: `${config.primaryKeyColumn} = :k`
  }
  return config.docClient.query(params).promise()
}

const buildResponse = (config, statusCode, errMessage, items) => {
  const response = {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': config.origin,
      'X-Content-Type-Options': 'nosniff'
    }
  }

  if (errMessage) {
    response.body = JSON.stringify({ message: errMessage })
  } else if (Array.isArray(items)) {
    response.body = JSON.stringify(items.map(item => {
      try {
        return JSON.parse(item.data)
      } catch (e) {
        return 'invalid object'
      }
    }))
  } else {
    response.body = items.data
  }
  return response
}

const evaluateResponse = (config, data) => {
  let payload = data.Item || data.Items
  let statusCode = 200
  if (!payload) {
    statusCode = 404
    return buildResponse(config, statusCode, 'not found')
  }
  return buildResponse(config, statusCode, null, payload)
}

const getLambda = async (event) => {
  const config = initialize()
  config.primaryKey = getAuthToken(event.headers)
  config.origin = getOrigin(event.headers)
  config.sortKey = event.pathParameters && event.pathParameters[config.sortKeyColumn]

  if (isConfigInvalid(config)) {
    console.error('lambda is not properly configured')
    return buildResponse(config, 500, 'internal server error')
  }

  let promise
  if (config.sortKey) {
    promise = doGet(config).then(dbResponse => evaluateResponse(config, dbResponse))
  } else {
    promise = doQuery(config).then(dbResponse => evaluateResponse(config, dbResponse))
  }

  return promise.catch(err => {
    console.error(err.message)
    return buildResponse(config, 500, 'internal server error')
  })
}

module.exports = getLambda
