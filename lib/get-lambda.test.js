const rewire = require('rewire')
const sinon = require('sinon')
const chai = require('chai')
chai.should()
chai.use(require('chai-as-promised'))
chai.use(require('sinon-chai'))

describe('get-lambda', () => {
  let sut
  let docClientMock
  let consoleStubs
  let event
  let response

  const promiseResolver = (value) => {
    return { promise: () => Promise.resolve(value) }
  }

  const setEnvVars = () => {
    sut.__set__('process', {
      env: {
        TABLE_NAME: 'table',
        PRIMARY_KEY_COLUMN_NAME: 'key',
        SORT_KEY_COLUMN_NAME: 'sort',
        REGION: 'us-west-2'
      }
    })
  }

  beforeEach(() => {
    sut = rewire('./get-lambda')
    const fakeDocClient = {
      get: () => 'get',
      query: () => 'query'
    }
    docClientMock = sinon.mock(fakeDocClient)
    const FakeDocClientConstructor = function () {
      Object.assign(this, fakeDocClient)
    }
    sut.__get__('AWS').DynamoDB = {
      DocumentClient: FakeDocClientConstructor
    }
    consoleStubs = {
      log: sinon.stub(),
      error: sinon.stub()
    }
    sut.__set__('console', consoleStubs)
    event = {
      pathParameters: {
        sort: 'sort'
      },
      headers: {
        Authorization: 'Bearer KEY',
        Origin: 'origin'
      }
    }
    response = {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'origin',
        'X-Content-Type-Options': 'nosniff'
      },
      body: JSON.stringify({ thing: 'stuff' })
    }
  })

  describe('when provided with the required pathParameter', () => {
    let params

    beforeEach(() => {
      setEnvVars()
      params = {
        TableName: 'table',
        Key: {
          key: 'KEY',
          sort: 'sort'
        }
      }
      docClientMock.expects('get')
        .withExactArgs(params)
        .returns(promiseResolver({ Item: { userId: 'KEY', data: JSON.stringify({ thing: 'stuff' }) } }))
    })

    describe('and an Authorization header', () => {
      it('should get from the table using the auth token as primary key and pathParameter as sort key', () => {
        return sut(event).should.eventually.deep.equal(response).then(() => {
          docClientMock.verify()
        })
      })
    })

    describe('and an authorization header', () => {
      it('should get from the table using the auth token as primary key and pathParameter as sort key', () => {
        event.headers.authorization = event.headers.Authorization
        delete event.headers.Authorization
        return sut(event).should.eventually.deep.equal(response).then(() => {
          docClientMock.verify()
        })
      })
    })

    describe('and an Origin header', () => {
      it('should get from the table using the auth token as primary key and pathParameter as sort key', () => {
        return sut(event).should.eventually.deep.equal(response).then(() => {
          docClientMock.verify()
        })
      })
    })

    describe('and an origin header', () => {
      it('should get from the table using the auth token as primary key and pathParameter as sort key', () => {
        event.headers.origin = event.headers.Origin
        delete event.headers.Origin
        return sut(event).should.eventually.deep.equal(response).then(() => {
          docClientMock.verify()
        })
      })
    })

    describe('and no indication of origin', () => {
      it('should get from the table using the auth token as primary key and pathParameter as sort key', () => {
        delete event.headers.Origin
        response.headers['Access-Control-Allow-Origin'] = '*'
        return sut(event).should.eventually.deep.equal(response).then(() => {
          docClientMock.verify()
        })
      })
    })
  })

  describe('when provided with the required pathParameter but there is no matching item', () => {
    it('should return a 404 response', () => {
      setEnvVars()
      const params = {
        TableName: 'table',
        Key: {
          key: 'KEY',
          sort: 'sort'
        }
      }
      docClientMock.expects('get')
        .withExactArgs(params)
        .returns(promiseResolver({}))
      response.statusCode = 404
      response.body = JSON.stringify({ message: 'not found' })
      return sut(event).should.eventually.deep.equal(response).then(() => {
        docClientMock.verify()
      })
    })
  })

  describe('when not provided with a pathParameter', () => {
    it('should query the table for the userId', () => {
      setEnvVars()
      delete event.pathParameters.sort
      const params = {
        TableName: 'table',
        ExpressionAttributeValues: {
          ':k': 'KEY'
        },
        KeyConditionExpression: 'key = :k'
      }
      docClientMock.expects('query')
        .withExactArgs(params)
        .returns(promiseResolver({ Items: [{ userId: 'user', data: JSON.stringify({ thing: 'stuff' }) }] }))
      response.statusCode = 200
      response.body = JSON.stringify([{ thing: 'stuff' }])
      return sut(event).should.eventually.deep.equal(response).then(() => {
        docClientMock.verify()
      })
    })

    it('should handle a badly formatted item', () => {
      setEnvVars()
      delete event.pathParameters.sort
      const params = {
        TableName: 'table',
        ExpressionAttributeValues: {
          ':k': 'KEY'
        },
        KeyConditionExpression: 'key = :k'
      }
      docClientMock.expects('query')
        .withExactArgs(params)
        .returns(promiseResolver({ Items: [{ userId: 'user', data: 'bad json' }] }))
      response.statusCode = 200
      response.body = JSON.stringify(['invalid object'])
      return sut(event).should.eventually.deep.equal(response).then(() => {
        docClientMock.verify()
      })
    })
  })

  describe('when the lambda is not properly configured', () => {
    it('should log the error and provide a 500 response', () => {
      response.statusCode = 500
      response.body = JSON.stringify({ message: 'internal server error' })
      sut.__set__('process', { env: {} })
      return sut(event).should.eventually.deep.equal(response).then(() => {
        consoleStubs.error.should.have.been.calledWith('lambda is not properly configured')
      })
    })
  })

  describe('when dynamo returns an error', () => {
    it('should log the error and re-throw it', () => {
      setEnvVars()
      const params = {
        TableName: 'table',
        Key: { key: 'KEY', sort: 'sort' }
      }
      docClientMock.expects('get')
        .withExactArgs(params)
        .returns({ promise: () => Promise.reject(new Error('error')) })
      response.statusCode = 500
      response.body = JSON.stringify({ message: 'internal server error' })
      return sut(event).should.eventually.deep.equal(response).then(() => {
        consoleStubs.error.should.have.been.calledWith('error')
      })
    })
  })
})
