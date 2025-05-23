const typeDefs = `
    type User {
        id: ID!
        name: String!
        age: Int!
    }

    type Query {
        getUser(id: ID!): User
        getUsers(limit: Int, offset: Int): [User!]!
    }

    type CreateUserResponse {
        message: String!
        user: User!
    }

    input UpdateUserInput {
        name: String
        age: Int
    }

    type Mutation {
        createUser(name: String!, age: Int!): CreateUserResponse
        updateUser(id: ID!, input: UpdateUserInput!): User
        deleteUser(id: ID!): Boolean
    }
`;

export default typeDefs;
