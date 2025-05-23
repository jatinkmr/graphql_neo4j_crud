const Joi = require('joi');

exports.createUserValidation = data => {
    const schema = Joi.object().keys({
        name: Joi.string().required(),
        age: Joi.number().required()
    })

    return schema.validate(data);
}
