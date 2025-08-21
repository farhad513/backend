class queryDoctors {
    doctors = []
    query = {}
    constructor(doctors, query) {
        this.doctors = doctors
        this.query = query
    }
    categoryQuery = () => {
        this.doctors = this.query.category ? this.doctors.filter(c => c.category === this.query.category) : this.doctors
        return this
    }
    
    
    searchQuery = () => {
        this.doctors = this.query.searchValue ? this.doctors.filter(p => p.name.toUpperCase().indexOf(this.query.searchValue.toUpperCase()) > -1) : this.doctors
        return this
    }
   
    skip = () => {
        let { pageNumber } = this.query
        const skipPage = (parseInt(pageNumber) - 1) * this.query.parPage

        let skipDoctor = []

        for (let i = skipPage; i < this.doctors.length; i++) {
            skipDoctor.push(this.doctors[i])
        }
        this.doctors = skipDoctor
        return this
    }
    limit = () => {
        let temp = []
        if (this.doctors.length > this.query.parPage) {
            for (let i = 0; i < this.query.parPage; i++) {
                temp.push(this.doctors[i])
            }
        } else {
            temp = this.doctors
        }
        this.doctors = temp

        return this
    }
    getdoctors = () => {
        return this.doctors
    }
    countdoctors = () => {
        return this.doctors.length
    }
}
module.exports = queryDoctors
