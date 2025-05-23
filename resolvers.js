import neo4j from 'neo4j-driver';
import { createUserValidation } from './validation.js';

const driver = neo4j.driver(
    'bolt://localhost:7687',
    neo4j.auth.basic('neo4j', 'neo4JP@ssw0rd')
);

const resolvers = {
    // for fetching data listing or particular info
    Query: {
        getUsers: async (_, { limit = 10, offset = 0 }) => {
            const session = driver.session();
            try {
                const result = await session.run(
                    `MATCH (u:User) RETURN u SKIP $offset LIMIT $limit`,
                    { limit: neo4j.int(limit), offset: neo4j.int(offset) }
                );

                return result.records.map(record => {
                    const userNode = record.get('u').properties;

                    return {
                        ...userNode,
                        age: neo4j.isInt(userNode.age) ? userNode.age.toNumber() : userNode.age
                    };
                });
            } catch (error) {
                throw new Error(error.message);
            } finally {
                await session.close();
            }
        },

        getUser: async (_, { id }) => {
            const session = driver.session();
            try {
                const result = await session.run('MATCH (u: User {id: $id}) RETURN u', { id });
                session.close();

                const record = result.records[0];
                if (!record) return null;

                const userNode = record.get('u').properties;

                return {
                    id: userNode.id,
                    name: userNode.name,
                    age: neo4j.isInt(userNode.age) ? userNode.age.toNumber() : userNode.age
                };
            } catch (error) {
                throw new Error(error.message);
            } finally {
                await session.close();
            }
        }
    },

    // for creation, updation or removal
    Mutation: {
        createUser: async (_, reqObj) => {
            const session = driver.session();
            try {
                const { error } = createUserValidation(reqObj);
                if (error) {
                    throw new Error(error.details[0].message || 'Validation failed!!');
                }

                const userId = Date.now().toString();

                const result = await session.run(
                    'CREATE (u:User {id: $id, name: $name, age: $age}) RETURN u',
                    {
                        id: userId,
                        name: reqObj.name,
                        age: neo4j.int(reqObj.age)
                    }
                );

                if (result.records.length === 0) {
                    throw new Error('Failed to create user');
                }

                const userNode = result.records[0].get('u').properties;

                const user = {
                    id: userNode.id,
                    name: userNode.name,
                    age: neo4j.isInt(userNode.age) ? userNode.age.toNumber() : userNode.age
                };

                return {
                    message: 'User created successfully',
                    user,
                };
            } catch (err) {
                console.log('@@@@@Error ', err)
                throw new Error(`Database error: ${err.message}`);
            } finally {
                session.close();
            }
        },

        updateUser: async (_, reqObj) => { },

        deleteUser: async (_, { id }) => {
            const session = driver.session();
            try {
                const checkResult = await session.run('MATCH (u:User {id: $id}) RETURN u', { id });

                if (!checkResult.records[0]) {
                    const error = new Error('User not found or does not exist');
                    error.extensions = { code: 'USER_NOT_FOUND' };
                    throw error;
                }

                const result = await session.run(
                    'MATCH (u:User {id: $id}) DETACH DELETE u RETURN COUNT(u) AS count',
                    { id }
                );

                const deletedCount = result.records[0].get('count').toNumber();
                if (deletedCount === 0) {
                    const error = new Error('User not found or does not exist');
                    error.extensions = { code: 'USER_NOT_FOUND' };
                    throw error;
                }
                return true;
            } catch (err) {
                console.log('@@@Error while removing the user', err);

                if (err.extensions?.code === 'USER_NOT_FOUND') {
                    throw err;
                }

                throw new Error(`Unable to remove user: ${err.message}`);
            } finally {
                session.close();
            }
        }
    }
};

export default resolvers;
export { driver };
