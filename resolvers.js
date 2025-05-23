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

        updateUser: async (_, { id, input }) => {
            console.log('id, input', id, input);
            const { age, name } = input;
            const session = driver.session();

            try {
                // Check if user exists first
                const checkResult = await session.run('MATCH (u:User {id: $id}) RETURN u', { id });

                if (!checkResult.records[0]) {
                    const error = new Error('User not found or does not exist');
                    error.extensions = { code: 'USER_NOT_FOUND' };
                    throw error;
                }

                // Validate and prepare updates
                const updates = {};
                let hasValidUpdates = false;

                // Validate name
                if (name !== undefined && name !== null) {
                    const trimmedName = String(name).trim();
                    if (trimmedName === '') {
                        throw new Error('Name cannot be empty');
                    }
                    updates.name = trimmedName;
                    hasValidUpdates = true;
                }

                // Validate age
                if (age !== undefined && age !== null) {
                    // Handle both string and number inputs
                    let ageValue;
                    if (typeof age === 'string') {
                        ageValue = parseInt(age, 10);
                    } else if (typeof age === 'number') {
                        ageValue = Math.floor(age); // Ensure it's an integer
                    } else {
                        throw new Error('Age must be a valid number');
                    }

                    if (isNaN(ageValue) || ageValue < 0) {
                        throw new Error('Age must be a valid positive number');
                    }

                    updates.age = neo4j.int(ageValue);
                    hasValidUpdates = true;
                    console.log('Age being set to:', ageValue, 'Neo4j int:', updates.age);
                }

                if (!hasValidUpdates) {
                    throw new Error('At least one field (name or age) must be provided and cannot be empty');
                }

                // Build dynamic query
                const setFields = Object.keys(updates).map(key => `u.${key} = $${key}`).join(', ');
                const query = `MATCH (u:User {id: $id}) SET ${setFields} RETURN u`;

                const params = { id, ...updates };
                const result = await session.run(query, params);

                if (!result.records[0]) {
                    throw new Error('Failed to update user');
                }

                const userNode = result.records[0].get('u').properties;

                // Return user with proper age conversion
                return {
                    id: userNode.id,
                    name: userNode.name,
                    age: neo4j.isInt(userNode.age) ? userNode.age.toNumber() : userNode.age
                };

            } catch (err) {
                console.log('@@@Error while updating user', err);

                // Handle custom errors with extensions
                if (err.extensions?.code === 'USER_NOT_FOUND') {
                    throw err;
                }

                throw new Error(err.message);
            } finally {
                session.close();
            }
        },

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
