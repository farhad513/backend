const authorOrder = require('../../models/auth.appoinment.model')
const customerAppoinmentModel = require('../../models/customerAppoinment')
const doctorModel = require("../../models/doctorModel")
const { mongo: { ObjectId } } = require('mongoose')
const { responseReturn } = require('../../utiles/response')
const hospitalModel = require('../../models/hospital.model')
const userModel = require("../../models/userModel")
module.exports.get_hospital_dashboard_data = async (req, res) => {
    const { id } = req;
    try { 
        const totalDoctor = await doctorModel.find({
            hospitalId: new ObjectId(id)
        }).countDocuments()
        const totalAppoinment = await authorOrder.find({
            hospitalId: new ObjectId(id)
        }).countDocuments()
        const totalPendingAppoinment = await authorOrder.find({
            $and: [
                {
                    hospitalId: {
                        $eq: new ObjectId(id)
                    }
                },
                {
                    status: {
                        $eq: 'pending'
                    }
                }
            ]
        }).countDocuments()

        const totalCompleteAppoinment = await authorOrder.find({
            $and: [
                {
                    hospitalId: {
                        $eq: new ObjectId(id)
                    }
                },
                {
                    status: {
                        $eq: 'confirmed'
                    }
                }
            ]
        }).countDocuments()


        const recentAppoinments = await authorOrder.find({
            hospitalId: new ObjectId(id)
          })
          .limit(5)
          .populate({
            path: "appoinmentId",
            select: "doctorName patientName category appointmentDate status serial"}).populate({path:"doctorId", select :"name category"}).sort({createdAt: -1});



        responseReturn(res, 200, {
            totalDoctor,
            totalPendingAppoinment,
            recentAppoinments,
            totalAppoinment,
            totalCompleteAppoinment
            })
    } catch (error) {
      return responseReturn(res, 400, { error: 'অনুরোধটি প্রক্রিয়া করা যায়নি।' });
    }
}

module.exports.get_admin_dashboard_data = async (req, res) => {
    const { id } = req
    try {
        

        const totalDoctor = await doctorModel.find({}).countDocuments()

        const totalAppoinment = await customerAppoinmentModel.find({}).countDocuments()

        const totalHospital = await hospitalModel.find({}).countDocuments()


        const recentAppoinments = await customerAppoinmentModel.find({}).limit(5)
        const totalUser = await userModel.find({}).countDocuments()

        responseReturn(res, 200, {
            totalDoctor,
            totalAppoinment,
            totalHospital,
            recentAppoinments,
            totalUser
        })

    } catch (error) {
      return responseReturn(res, 400, { error: 'অনুরোধটি প্রক্রিয়া করা যায়নি।' });
    }

}